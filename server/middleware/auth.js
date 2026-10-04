const crypto = require('node:crypto');
const { getCuratorBySessionTokenHash } = require('../db');
const { hashSessionToken } = require('../crypto');
const { getClientIp } = require('./security');

/**
 * Extract authenticated curator from the session cookie
 */
function getAuthenticatedCurator(req) {
    const cookies = req.cookies || {};
    const rawToken = cookies.wabisabi_curator_session || cookies.wabisabi_session;
    if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/i.test(rawToken)) return null;

    try {
        const tokenHash = hashSessionToken(rawToken);
        const curator = getCuratorBySessionTokenHash(tokenHash);
        if (!curator) return null;

        return {
            id: curator.id,
            email: curator.email,
            displayName: curator.display_name,
            handle: curator.handle,
            role: 'CURATOR',
            sessionId: curator.session_id
        };
    } catch (err) {
        console.error('getAuthenticatedCurator error:', err);
        return null;
    }
}

/**
 * Curator RBAC Middleware for JSON API routes:
 * Strictly verifies that the request has an active curator session.
 */
function requireCurator(req, res, next) {
    const curator = getAuthenticatedCurator(req);
    if (!curator) {
        if (req.cookies && (req.cookies.wabisabi_curator_session || req.cookies.wabisabi_session)) {
            res.clearCookie('wabisabi_curator_session', { httpOnly: true, sameSite: 'lax', path: '/' });
            res.clearCookie('wabisabi_session', { httpOnly: true, sameSite: 'lax', path: '/' });
        }
        return res.status(401).json({
            success: false,
            error: 'Authentication required. Only Curators can perform this action.'
        });
    }

    req.curator = curator;
    req.user = curator; // alias for backwards compatibility
    next();
}

/**
 * Page-Level Curator Guard:
 * Protects curator dashboard pages (/curator). Redirects unauthorized visitors to /login.
 */
function requireCuratorPage(req, res, next) {
    res.setHeader('Cache-Control', 'private, no-store');
    const curator = getAuthenticatedCurator(req);
    if (!curator) {
        if (req.cookies && (req.cookies.wabisabi_curator_session || req.cookies.wabisabi_session)) {
            res.clearCookie('wabisabi_curator_session', { httpOnly: true, sameSite: 'lax', path: '/' });
            res.clearCookie('wabisabi_session', { httpOnly: true, sameSite: 'lax', path: '/' });
        }
        const returnUrl = req.originalUrl || req.url;
        return res.redirect(`/sanctuary?redirect=${encodeURIComponent(returnUrl)}`);
    }
    req.curator = curator;
    req.user = curator;
    next();
}

/**
 * In-memory login throttling. Both an account/IP pair and the IP itself are
 * tracked so changing the `identifier` field cannot bypass the limit. Expired
 * records are pruned and the maps have hard size caps to prevent memory abuse.
 */
const failedAttemptsByIdentity = new Map();
const failedAttemptsByIp = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_PER_IDENTITY = 5;
const MAX_FAILED_PER_IP = 20;
const MAX_TRACKED_LOGIN_KEYS = 10000;
let lastLoginPruneAt = 0;

function loginIdentity(req) {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const raw = body.identifier ?? body.email ?? body.username ?? '';
    return typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 254) : '';
}

function liveRecord(map, key, now) {
    const record = map.get(key);
    if (record && record.resetAt <= now) {
        map.delete(key);
        return null;
    }
    return record || null;
}

function pruneLoginAttempts(now) {
    if (now - lastLoginPruneAt < 60 * 1000 &&
        failedAttemptsByIdentity.size < MAX_TRACKED_LOGIN_KEYS &&
        failedAttemptsByIp.size < MAX_TRACKED_LOGIN_KEYS) return;

    lastLoginPruneAt = now;
    for (const [key, record] of failedAttemptsByIdentity) {
        if (record.resetAt <= now) failedAttemptsByIdentity.delete(key);
    }
    for (const [key, record] of failedAttemptsByIp) {
        if (record.resetAt <= now) failedAttemptsByIp.delete(key);
    }
    while (failedAttemptsByIdentity.size > MAX_TRACKED_LOGIN_KEYS) {
        failedAttemptsByIdentity.delete(failedAttemptsByIdentity.keys().next().value);
    }
    while (failedAttemptsByIp.size > MAX_TRACKED_LOGIN_KEYS) {
        failedAttemptsByIp.delete(failedAttemptsByIp.keys().next().value);
    }
}

function loginLimitResponse(res, record) {
    const minutesLeft = Math.max(1, Math.ceil((record.resetAt - Date.now()) / 60000));
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((record.resetAt - Date.now()) / 1000))));
    return res.status(429).json({
        success: false,
        error: `Too many unsuccessful login attempts. For your security, please wait ${minutesLeft} minute(s) before trying again.`
    });
}

function checkLoginRateLimit(req, res, next) {
    const now = Date.now();
    pruneLoginAttempts(now);
    const ip = getClientIp(req);
    const identity = loginIdentity(req);
    const ipRecord = liveRecord(failedAttemptsByIp, ip, now);
    const identityKey = `${ip}:${crypto.createHash('sha256').update(identity).digest('hex')}`;
    const identityRecord = liveRecord(failedAttemptsByIdentity, identityKey, now);

    if (identityRecord && identityRecord.count >= MAX_FAILED_PER_IDENTITY) {
        return loginLimitResponse(res, identityRecord);
    }
    if (ipRecord && ipRecord.count >= MAX_FAILED_PER_IP) {
        return loginLimitResponse(res, ipRecord);
    }
    next();
}

function incrementAttempt(map, key, now) {
    const current = liveRecord(map, key, now);
    if (current) {
        current.count += 1;
        return current;
    }
    const record = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    map.set(key, record);
    return record;
}

function recordLoginFailure(req) {
    const now = Date.now();
    const ip = getClientIp(req);
    const identity = loginIdentity(req);
    const identityKey = `${ip}:${crypto.createHash('sha256').update(identity).digest('hex')}`;
    incrementAttempt(failedAttemptsByIdentity, identityKey, now);
    incrementAttempt(failedAttemptsByIp, ip, now);
    pruneLoginAttempts(now);
}

function clearLoginFailures(req) {
    const ip = getClientIp(req);
    const identity = loginIdentity(req);
    const identityKey = `${ip}:${crypto.createHash('sha256').update(identity).digest('hex')}`;
    failedAttemptsByIdentity.delete(identityKey);
    failedAttemptsByIp.delete(ip);
}

module.exports = {
    requireCurator,
    requireAuth: requireCurator, // alias
    requireCuratorPage,
    getAuthenticatedCurator,
    getAuthenticatedUser: getAuthenticatedCurator,
    checkLoginRateLimit,
    recordLoginFailure,
    clearLoginFailures
};

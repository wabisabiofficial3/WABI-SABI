const { getCuratorBySessionTokenHash } = require('../db');
const { hashSessionToken } = require('../crypto');

/**
 * Extract authenticated curator from the session cookie
 */
function getAuthenticatedCurator(req) {
    const rawToken = req.cookies ? (req.cookies.wabisabi_curator_session || req.cookies.wabisabi_session) : null;
    if (!rawToken) return null;

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
 * In-Memory Failed Login Rate Limiter:
 * Throttles repeated failed attempts per IP + target identifier
 */
const failedAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

function checkLoginRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const identifier = (req.body && (req.body.email || req.body.username) ? (req.body.email || req.body.username).trim().toLowerCase() : '');
    const key = `${ip}:${identifier}`;
    const now = Date.now();

    const record = failedAttempts.get(key);
    if (record) {
        if (now - record.firstFailedAt > RATE_LIMIT_WINDOW_MS) {
            failedAttempts.delete(key);
        } else if (record.count >= MAX_FAILED_ATTEMPTS) {
            const minutesLeft = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.firstFailedAt)) / 60000);
            return res.status(429).json({
                success: false,
                error: `Too many unsuccessful login attempts. For your security, please wait ${minutesLeft} minute(s) before trying again.`
            });
        }
    }

    next();
}

function recordLoginFailure(req) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const identifier = (req.body && (req.body.email || req.body.username) ? (req.body.email || req.body.username).trim().toLowerCase() : '');
    const key = `${ip}:${identifier}`;
    const now = Date.now();

    const record = failedAttempts.get(key);
    if (!record || (now - record.firstFailedAt > RATE_LIMIT_WINDOW_MS)) {
        failedAttempts.set(key, { count: 1, firstFailedAt: now });
    } else {
        record.count += 1;
    }
}

function clearLoginFailures(req) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const identifier = (req.body && (req.body.email || req.body.username) ? (req.body.email || req.body.username).trim().toLowerCase() : '');
    const key = `${ip}:${identifier}`;
    failedAttempts.delete(key);
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

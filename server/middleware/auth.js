const { db } = require('../db');
const { hashSessionToken } = require('../crypto');

/**
 * Authentication Middleware:
 * Inspects the HTTP-only 'wabisabi_session' cookie, checks cryptographic hash against SQLite,
 * validates expiry, and attaches the authenticated user record to req.user.
 */
function requireAuth(req, res, next) {
    const rawToken = req.cookies ? req.cookies.wabisabi_session : null;
    if (!rawToken) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required. Please sign in.'
        });
    }

    try {
        const tokenHash = hashSessionToken(rawToken);
        const stmt = db.prepare(`
            SELECT s.id AS session_id, s.expires_at, 
                   u.id, u.email, u.display_name, u.handle, u.role, u.status
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
        `);
        const row = stmt.get(tokenHash);

        if (!row) {
            res.clearCookie('wabisabi_session', { httpOnly: true, sameSite: 'lax', path: '/' });
            return res.status(401).json({
                success: false,
                error: 'Session has expired or is invalid. Please sign in again.'
            });
        }

        req.user = {
            id: row.id,
            email: row.email,
            displayName: row.display_name,
            handle: row.handle,
            role: row.role,
            status: row.status,
            sessionId: row.session_id
        };

        next();
    } catch (err) {
        console.error('requireAuth middleware error:', err);
        return res.status(500).json({ success: false, error: 'Internal authentication error.' });
    }
}

/**
 * Curator RBAC Middleware:
 * Verifies that the authenticated user possesses the CURATOR role.
 * Strictly enforced on the server — never relies on browser state.
 */
function requireCurator(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    if (req.user.role !== 'CURATOR') {
        return res.status(403).json({
            success: false,
            error: 'Forbidden: Curator privileges required to access this resource.'
        });
    }

    next();
}

/**
 * In-Memory Failed Login Rate Limiter:
 * Throttles repeated failed attempts per IP and target email to prevent brute-force attacks.
 */
const failedAttempts = new Map(); // key: `${ip}:${email}` -> { count, firstFailedAt }
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

function checkLoginRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = (req.body && req.body.email ? req.body.email.trim().toLowerCase() : '');
    const key = `${ip}:${email}`;
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
    const email = (req.body && req.body.email ? req.body.email.trim().toLowerCase() : '');
    const key = `${ip}:${email}`;
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
    const email = (req.body && req.body.email ? req.body.email.trim().toLowerCase() : '');
    const key = `${ip}:${email}`;
    failedAttempts.delete(key);
}

module.exports = {
    requireAuth,
    requireCurator,
    checkLoginRateLimit,
    recordLoginFailure,
    clearLoginFailures
};

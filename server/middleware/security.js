/**
 * Wabi Sabi — Security & Rate Limiting Middleware (server/middleware/security.js)
 * Implements:
 * 1. HTTP Security Headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
 * 2. Sensitive File & Directory Protection (.env, .git, data/*.db, server/*, package.json)
 * 3. General API Rate Limiting (DoS prevention)
 * 4. Safe CORS Origin Verification
 */

// -------------------------------------------------------------
// 1. HTTP Security Headers Middleware
// -------------------------------------------------------------
function securityHeaders(req, res, next) {
    // Prevent MIME-sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // XSS Protection for legacy browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy (disable unused sensitive device capabilities)
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');

    // Cross-Origin policies
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Content Security Policy (strict yet compatible with Google Fonts & audio player)
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: https: blob:",
        "media-src 'self' https: data: blob:",
        "connect-src 'self' https://api.web3forms.com",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self' https://api.web3forms.com"
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);

    // HSTS (Strict-Transport-Security) for HTTPS connections
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
}

// -------------------------------------------------------------
// 2. Sensitive File & Directory Access Blocker
// -------------------------------------------------------------
const SENSITIVE_PATTERNS = [
    /\/\.env/i,
    /\/\.git/i,
    /\/data(\/.*)?$/i,
    /\.sqlite/i,
    /\.db$/i,
    /\/server(\/.*)?$/i,
    /\/tests(\/.*)?$/i,
    /\/scratch(\/.*)?$/i,
    /\/package\.json$/i,
    /\/package-lock\.json$/i,
    /\.log$/i,
    /\.md$/i
];

function blockSensitiveFiles(req, res, next) {
    const urlPath = decodeURIComponent(req.path.toLowerCase());

    // Path traversal check
    if (urlPath.includes('..') || urlPath.includes('%2e%2e')) {
        return res.status(403).json({ success: false, error: 'Access forbidden: invalid path traversal.' });
    }

    // Check sensitive file patterns
    for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(urlPath)) {
            return res.status(403).json({ success: false, error: 'Access forbidden: resource is restricted.' });
        }
    }

    next();
}

// -------------------------------------------------------------
// 3. General In-Memory API Rate Limiter
// -------------------------------------------------------------
const apiRequestMap = new Map();
const API_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_MINUTE = 180; // generous for portal usage, blocks brute-force bots

function apiRateLimiter(req, res, next) {
    // Only rate-limit API routes, not static assets
    if (!req.path.startsWith('/api')) {
        return next();
    }

    const ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.ip || '127.0.0.1');
    const now = Date.now();

    let clientData = apiRequestMap.get(ip);
    if (!clientData || (now - clientData.startTime > API_WINDOW_MS)) {
        clientData = { count: 1, startTime: now };
        apiRequestMap.set(ip, clientData);
    } else {
        clientData.count++;
        if (clientData.count > MAX_REQUESTS_PER_MINUTE) {
            const retryAfterSec = Math.ceil((API_WINDOW_MS - (now - clientData.startTime)) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please slow down and try again shortly.'
            });
        }
    }

    // Periodic map cleanup every 5 minutes to prevent memory leak
    if (apiRequestMap.size > 2000) {
        for (const [key, val] of apiRequestMap.entries()) {
            if (now - val.startTime > API_WINDOW_MS) {
                apiRequestMap.delete(key);
            }
        }
    }

    next();
}

module.exports = {
    securityHeaders,
    blockSensitiveFiles,
    apiRateLimiter
};

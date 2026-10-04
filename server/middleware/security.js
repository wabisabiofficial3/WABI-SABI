/**
 * Wabi Sabi — HTTP security, origin checks, sensitive-path protection and rate limits.
 */

function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "object-src 'none'",
        "img-src 'self' data: https: blob:",
        "media-src 'self' https: data: blob:",
        "connect-src 'self' https://api.web3forms.com",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self' https://api.web3forms.com"
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);

    if (req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
}

const SENSITIVE_PATTERNS = [
    /\/\.env(?:\/|$)/i,
    /\/\.git(?:\/|$)/i,
    /\/data(?:\/.*)?$/i,
    /\.sqlite(?:3)?(?:-wal|-shm)?$/i,
    /\.db(?:-wal|-shm)?$/i,
    /\/server(?:\/.*)?$/i,
    /\/tests(?:\/.*)?$/i,
    /\/scratch(?:\/.*)?$/i,
    /\/package(?:-lock)?\.json$/i,
    /\.log$/i,
    /\.md$/i
];

function blockSensitiveFiles(req, res, next) {
    let urlPath;
    try {
        // req.path is normally percent-encoded. Decode once so encoded traversal and
        // sensitive filenames receive the same treatment as their literal forms.
        urlPath = decodeURIComponent(req.path).toLowerCase();
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Malformed request path.' });
    }

    if (urlPath.includes('..') || urlPath.includes('\0')) {
        return res.status(403).json({ success: false, error: 'Access forbidden: invalid path traversal.' });
    }

    if (SENSITIVE_PATTERNS.some(pattern => pattern.test(urlPath))) {
        return res.status(403).json({ success: false, error: 'Access forbidden: resource is restricted.' });
    }

    next();
}

const allowedOrigins = new Set(
    (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => {
            try {
                return new URL(value).origin;
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean)
);

function requestOrigin(req) {
    try {
        const proxySetting = req.app && typeof req.app.get === 'function'
            ? req.app.get('trust proxy')
            : false;
        const trustsProxy = proxySetting === true ||
            (typeof proxySetting === 'number' && proxySetting > 0) ||
            typeof proxySetting === 'function' || Array.isArray(proxySetting);
        const forwardedHost = trustsProxy ? req.get('x-forwarded-host') : null;
        const effectiveHost = typeof forwardedHost === 'string' && forwardedHost.trim()
            ? forwardedHost.split(',')[0].trim()
            : req.get('host');
        return new URL(`${req.protocol}://${effectiveHost}`).origin;
    } catch (error) {
        return null;
    }
}

function normalizeOrigin(origin) {
    if (typeof origin !== 'string' || !origin.trim() || origin.trim() === 'null') return null;
    try {
        return new URL(origin).origin;
    } catch (error) {
        return null;
    }
}

function isAllowedOrigin(req, origin) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) return false;
    return normalizedOrigin === requestOrigin(req) || allowedOrigins.has(normalizedOrigin);
}

/**
 * Same-origin by default. Cross-origin credentials are permitted only for an exact
 * origin listed in CORS_ALLOWED_ORIGINS. A reverse proxy can obscure the browser-facing
 * host from Express, so a valid Origin paired with the browser-controlled
 * Sec-Fetch-Site: same-origin is accepted as a narrow same-origin fallback. Foreign,
 * same-site, opaque, and malformed origins are not covered by that fallback.
 */
function corsAndCsrf(req, res, next) {
    const origin = req.get('origin');
    const normalizedOrigin = normalizeOrigin(origin);
    const fetchSite = (req.get('sec-fetch-site') || '').trim().toLowerCase();
    const browserConfirmsSameOrigin = fetchSite === 'same-origin';
    const method = req.method.toUpperCase();
    const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const allowed = Boolean(normalizedOrigin) && (
        isAllowedOrigin(req, normalizedOrigin) || browserConfirmsSameOrigin
    );

    res.vary('Origin');

    if (origin && !allowed) {
        return res.status(403).json({ success: false, error: 'Request origin is not allowed.' });
    }

    if (!origin && isUnsafeMethod && fetchSite && fetchSite !== 'same-origin') {
        return res.status(403).json({ success: false, error: 'Cross-site state changes are not allowed.' });
    }

    if (origin && allowed) {
        res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Curator-Preview');
        res.setHeader('Access-Control-Max-Age', '600');
    }

    if (method === 'OPTIONS') {
        return res.sendStatus(origin && !allowed ? 403 : 204);
    }

    next();
}

const apiRequestMap = new Map();
const API_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 180;
const MAX_TRACKED_CLIENTS = 10000;
let lastApiPruneAt = 0;

function getClientIp(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function pruneExpiredRequests(now) {
    if (now - lastApiPruneAt < API_WINDOW_MS && apiRequestMap.size < MAX_TRACKED_CLIENTS) return;
    lastApiPruneAt = now;
    for (const [ip, data] of apiRequestMap) {
        if (now - data.startTime >= API_WINDOW_MS) apiRequestMap.delete(ip);
    }
    while (apiRequestMap.size > MAX_TRACKED_CLIENTS) {
        apiRequestMap.delete(apiRequestMap.keys().next().value);
    }
}

function apiRateLimiter(req, res, next) {
    // When mounted with app.use('/api', ...), req.path is relative to /api; use
    // originalUrl so the limiter does not silently skip every mounted request.
    const requestPath = (req.originalUrl || req.url || '').split('?')[0];
    if (!/^\/api(?:\/|$)/i.test(requestPath)) return next();

    const ip = getClientIp(req);
    const now = Date.now();
    let clientData = apiRequestMap.get(ip);

    if (!clientData || now - clientData.startTime >= API_WINDOW_MS) {
        clientData = { count: 1, startTime: now };
        apiRequestMap.set(ip, clientData);
    } else {
        clientData.count += 1;
        if (clientData.count > MAX_REQUESTS_PER_MINUTE) {
            const retryAfterSec = Math.max(1, Math.ceil((API_WINDOW_MS - (now - clientData.startTime)) / 1000));
            res.setHeader('Retry-After', String(retryAfterSec));
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please slow down and try again shortly.'
            });
        }
    }

    pruneExpiredRequests(now);
    next();
}

module.exports = {
    securityHeaders,
    blockSensitiveFiles,
    corsAndCsrf,
    apiRateLimiter,
    getClientIp
};

require('./test_config');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { baseUrl } = require('./test_config');
const { apiRateLimiter, corsAndCsrf, securityHeaders } = require('../server/middleware/security');
const { curatorSessionCookieOptions } = require('../server/sessionCookies');

function checkOrigin({ origin, host, forwardedHost, trustProxy, fetchSite }) {
    const reqHeaders = {
        origin,
        host,
        'x-forwarded-host': forwardedHost,
        'sec-fetch-site': fetchSite
    };
    const response = { headers: {}, status: null, body: null };
    const req = {
        protocol: 'https',
        method: 'POST',
        get(name) { return reqHeaders[name.toLowerCase()]; },
        app: { get(name) { return name === 'trust proxy' ? trustProxy : undefined; } }
    };
    const res = {
        vary() { return this; },
        setHeader(name, value) { response.headers[name.toLowerCase()] = value; },
        status(code) { response.status = code; return this; },
        json(body) { response.body = body; return this; },
        sendStatus(code) { response.status = code; return this; }
    };
    response.nextCalled = false;
    corsAndCsrf(req, res, () => { response.nextCalled = true; });
    return response;
}

async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body = options.body;
    if (body !== undefined && typeof body !== 'string' && !(body instanceof URLSearchParams)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }
    return fetch(new URL(path, baseUrl), { ...options, headers, body });
}

async function run() {
    console.log('\nSecurity hardening regressions:');

    const headers = {};
    securityHeaders({ secure: false }, {
        setHeader(name, value) { headers[name.toLowerCase()] = value; }
    }, () => {});
    const contentSecurityPolicy = headers['content-security-policy'] || '';
    assert.match(contentSecurityPolicy, /object-src 'none'/);
    assert.doesNotMatch(contentSecurityPolicy, /script-src[^;]*fonts\.googleapis/i);
    console.log('✓ CSP blocks plugin objects and excludes style-only origins from script execution.');

    const previousPartitionedFlag = process.env.WABI_PREVIEW_PARTITIONED_COOKIES;
    const previousAppBaseUrl = process.env.APP_BASE_URL;
    process.env.WABI_PREVIEW_PARTITIONED_COOKIES = 'true';
    delete process.env.APP_BASE_URL;
    const embeddedPreviewCookie = curatorSessionCookieOptions({ secure: true });
    assert.equal(embeddedPreviewCookie.httpOnly, true);
    assert.equal(embeddedPreviewCookie.secure, true);
    assert.equal(embeddedPreviewCookie.sameSite, 'none');
    assert.equal(embeddedPreviewCookie.partitioned, true);
    const legacyCookieCleanup = curatorSessionCookieOptions({ secure: true }, { sameSite: 'lax', partitioned: false });
    assert.equal(legacyCookieCleanup.sameSite, 'lax');
    assert.equal(legacyCookieCleanup.partitioned, false);
    const insecurePreviewCookie = curatorSessionCookieOptions({ secure: false });
    assert.equal(insecurePreviewCookie.sameSite, 'lax', 'Partitioned cookies must not be emitted without HTTPS.');
    assert.equal(insecurePreviewCookie.partitioned, undefined);
    process.env.APP_BASE_URL = 'https://preview.example';
    const proxyTerminatedHttpsCookie = curatorSessionCookieOptions({ secure: false });
    assert.equal(proxyTerminatedHttpsCookie.secure, true, 'Configured HTTPS preview cookies must stay Secure even if the proxy omits X-Forwarded-Proto.');
    assert.equal(proxyTerminatedHttpsCookie.sameSite, 'none');
    assert.equal(proxyTerminatedHttpsCookie.partitioned, true);
    if (previousPartitionedFlag === undefined) delete process.env.WABI_PREVIEW_PARTITIONED_COOKIES;
    else process.env.WABI_PREVIEW_PARTITIONED_COOKIES = previousPartitionedFlag;
    if (previousAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previousAppBaseUrl;
    const ordinaryCookie = curatorSessionCookieOptions({ secure: true });
    assert.equal(ordinaryCookie.sameSite, 'lax', 'First-party sessions must remain SameSite=Lax by default.');
    console.log('✓ Embedded preview sessions use Secure, HttpOnly, partitioned cookies; defaults remain first-party.');

    const previewOrigin = 'https://3000-preview-id.e2b.app';
    const forwardedOrigin = checkOrigin({
        origin: previewOrigin,
        host: 'wabi-service.internal:3000',
        forwardedHost: '3000-preview-id.e2b.app',
        trustProxy: 1
    });
    assert.equal(forwardedOrigin.nextCalled, true, 'Trusted forwarded host should match the browser preview origin.');
    assert.equal(forwardedOrigin.headers['access-control-allow-origin'], previewOrigin);
    const foreignOrigin = checkOrigin({
        origin: 'https://attacker.example',
        host: 'wabi-service.internal:3000',
        forwardedHost: '3000-preview-id.e2b.app',
        trustProxy: 1
    });
    assert.equal(foreignOrigin.status, 403, 'A foreign Origin must remain rejected behind the proxy.');
    const untrustedForwardedHost = checkOrigin({
        origin: previewOrigin,
        host: 'wabi-service.internal:3000',
        forwardedHost: '3000-preview-id.e2b.app',
        trustProxy: 0
    });
    assert.equal(untrustedForwardedHost.status, 403, 'Forwarded host must be ignored when proxy trust is disabled.');

    const proxyOriginMismatch = 'https://preview-origin-mismatch.example';
    const browserConfirmedSameOrigin = checkOrigin({
        origin: proxyOriginMismatch,
        host: 'wabi-service.internal:3000',
        forwardedHost: 'proxy-service.internal:3000',
        trustProxy: 1,
        fetchSite: 'same-origin'
    });
    assert.equal(browserConfirmedSameOrigin.nextCalled, true, 'Browser-confirmed same-origin requests should survive reverse-proxy host rewriting.');
    assert.equal(browserConfirmedSameOrigin.headers['access-control-allow-origin'], proxyOriginMismatch);

    const sameSiteSiblingOrigin = checkOrigin({
        origin: proxyOriginMismatch,
        host: 'wabi-service.internal:3000',
        forwardedHost: 'proxy-service.internal:3000',
        trustProxy: 1,
        fetchSite: 'same-site'
    });
    assert.equal(sameSiteSiblingOrigin.status, 403, 'Same-site sibling origins must not use the proxy fallback.');

    const opaqueOrigin = checkOrigin({
        origin: 'null',
        host: 'wabi-service.internal:3000',
        forwardedHost: 'proxy-service.internal:3000',
        trustProxy: 1,
        fetchSite: 'same-origin'
    });
    assert.equal(opaqueOrigin.status, 403, 'Opaque origins must remain blocked even when fetch metadata is present.');
    console.log('✓ Trusted preview origins and browser-confirmed same-origin proxy requests work; foreign origins remain blocked.');

    // Express routes are case-insensitive by default; the limiter must be too.
    let allowedRequests = 0;
    let blockedStatus = null;
    let blockedBody = null;
    const limitReq = {
        originalUrl: '/API/health?probe=1',
        url: '/API/health?probe=1',
        ip: '198.51.100.42'
    };
    for (let i = 0; i < 181; i += 1) {
        const limitRes = {
            setHeader() { return this; },
            status(code) { blockedStatus = code; return this; },
            json(payload) { blockedBody = payload; return this; }
        };
        apiRateLimiter(limitReq, limitRes, () => { allowedRequests += 1; });
    }
    assert.equal(allowedRequests, 180, 'Mixed-case /API paths must use the same request quota.');
    assert.equal(blockedStatus, 429, 'The request after the case-insensitive quota must be rejected.');
    assert(blockedBody?.error, 'Rate-limit responses must include a safe message.');
    const mixedCaseMemberApi = await request('/API/member/me', {
        headers: { Accept: '*/*' }
    });
    assert.equal(mixedCaseMemberApi.status, 401, 'Mixed-case API requests must keep the JSON authentication guard.');
    assert.match(mixedCaseMemberApi.headers.get('content-type') || '', /application\/json/i);
    const sameSiteCrossOrigin = await request('/api/curator/features', {
        method: 'PUT',
        headers: { 'Sec-Fetch-Site': 'same-site' },
        body: { paper_plane_enabled: true }
    });
    assert.equal(sameSiteCrossOrigin.status, 403, 'Same-site sibling requests without an Origin must not perform state changes.');
    console.log('✓ Mixed-case API paths remain protected; missing-Origin same-site writes are rejected.');

    const malformed = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{'
    });
    assert.equal(malformed.status, 400);
    assert.match(malformed.headers.get('content-type') || '', /application\/json/i);
    const malformedText = await malformed.text();
    assert.equal(JSON.parse(malformedText).error, 'Invalid request.');
    assert.doesNotMatch(malformedText, /node_modules|server[\\/]index\.js|SyntaxError:/i);

    const oversized = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oversized: 'x'.repeat(110 * 1024) })
    });
    assert.equal(oversized.status, 413, 'JSON request bodies above the configured limit must be rejected.');
    assert.match(oversized.headers.get('content-type') || '', /application\/json/i);
    const oversizedText = await oversized.text();
    assert.equal(JSON.parse(oversizedText).error, 'Request body exceeds the allowed size.');
    assert.doesNotMatch(oversizedText, /node_modules|server[\\/]index\.js|PayloadTooLargeError/i);
    console.log('✓ Parser errors and oversized payloads return bounded, non-disclosing JSON errors.');

    const savedProfile = await request('/api/user/profile', {
        method: 'POST',
        body: { name: 'Private Reader', genre: 'Mystery' }
    });
    assert.equal(savedProfile.status, 200);
    const setCookie = savedProfile.headers.get('set-cookie') || '';
    assert.match(setCookie, /wabisabi_reader=/);
    assert.match(setCookie, /HttpOnly/i, 'Remembered profile cookies should not be script-readable.');
    const readerCookie = setCookie.split(';')[0];

    const profile = await request('/api/user/profile', { headers: { Cookie: readerCookie } });
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).reader.name, 'Private Reader');

    const clearedProfile = await request('/api/user/profile', {
        method: 'DELETE',
        headers: { Cookie: readerCookie }
    });
    assert.equal(clearedProfile.status, 200);
    assert.match(clearedProfile.headers.get('set-cookie') || '', /HttpOnly/i);
    console.log('✓ Reader memory continues through its API while its persistent cookie is HttpOnly.');

    if (process.platform !== 'win32') {
        const databasePath = process.env.WABI_DB_PATH;
        assert(databasePath && fs.existsSync(databasePath), 'The test SQLite database should exist.');
        for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`]) {
            if (!fs.existsSync(filePath)) continue;
            const permissions = fs.statSync(filePath).mode & 0o777;
            assert.equal(permissions & 0o077, 0, `${filePath} must not be readable by group or other users.`);
        }
        console.log('✓ SQLite database and live sidecars are restricted to the service owner.');
    }
}

run().catch((error) => {
    console.error('Security hardening checks failed:', error);
    process.exit(1);
});

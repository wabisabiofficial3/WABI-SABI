require('./test_config');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { baseUrl } = require('./test_config');
const { apiRateLimiter, securityHeaders } = require('../server/middleware/security');

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

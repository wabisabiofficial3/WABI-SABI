const assert = require('node:assert/strict');
const { baseUrl, ADMIN_PASSWORD } = require('./test_config');

async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body = options.body;
    if (body !== undefined && typeof body !== 'string' && !(body instanceof URLSearchParams)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }
    const response = await fetch(new URL(path, baseUrl), { ...options, headers, body });
    const text = await response.text();
    let data = text;
    try { data = JSON.parse(text); } catch {}
    return { response, data, text };
}

async function run() {
    console.log('\nFunctional security and data-integrity regressions:');

    // Exact-origin CORS and CSRF protection.
    let result = await request('/api/portal', { headers: { Origin: 'https://attackerwabi-sabi.example' } });
    assert.equal(result.response.status, 403, 'An origin that only contains the brand substring must be rejected.');
    result = await request('/api/portal', { headers: { Origin: baseUrl } });
    assert.equal(result.response.status, 200, 'The exact same origin must be allowed.');
    assert.equal(result.response.headers.get('access-control-allow-origin'), new URL(baseUrl).origin);
    result = await request('/api/curator/features', {
        method: 'OPTIONS',
        headers: {
            Origin: 'https://evil.example',
            'Access-Control-Request-Method': 'PUT',
            'Access-Control-Request-Headers': 'content-type'
        }
    });
    assert.equal(result.response.status, 403, 'Untrusted preflight must be rejected.');
    result = await request('/api/curator/features', {
        method: 'POST',
        headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: {}
    });
    assert.equal(result.response.status, 403, 'Cross-origin state changes must be rejected before route handling.');
    console.log('✓ Same-origin policy rejects malicious origins and state-changing cross-site requests.');

    // Sensitive resources remain inaccessible.
    for (const filePath of ['/server/db.js', '/package.json', '/data/wabisabi.db', '/tests/run_all_tests.js']) {
        const { response } = await request(filePath);
        assert([403, 404].includes(response.status), `${filePath} must not be served.`);
    }
    console.log('✓ Server source, config, database and test files are not served.');

    // Curator auth/cookies, validation and safe link handling.
    const login = await request('/api/auth/login', {
        method: 'POST',
        body: { identifier: 'wabisabiofficial3@gmail.com', password: ADMIN_PASSWORD }
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.response.headers.get('cache-control'), 'no-store');
    const cookieHeader = login.response.headers.get('set-cookie');
    assert(cookieHeader && cookieHeader.includes('HttpOnly') && cookieHeader.toLowerCase().includes('samesite=lax'));
    const curatorCookie = cookieHeader.split(',')[0].split(';')[0];

    result = await request('/api/curator/buttons', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { community_chat_url: 'javascript:alert(document.domain)' }
    });
    assert.equal(result.response.status, 400, 'Unsafe schemes must not be saved as external links.');
    result = await request('/api/curator/features', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { paper_plane_enabled: 'false' }
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.settings.paper_plane_enabled, false, 'String false must not be treated as true.');
    result = await request('/api/curator/features', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { paper_plane_enabled: 'not-a-boolean' }
    });
    assert.equal(result.response.status, 400);
    result = await request('/api/curator/updates', {
        method: 'POST',
        headers: { Cookie: curatorCookie },
        body: { title: 'Regression bulletin', content: 'Boolean pin input check.', is_pinned: 'false' }
    });
    assert.equal(result.response.status, 201);
    const portal = await request('/api/portal');
    const bulletin = portal.data.updates.find(item => item.id === result.data.updateId);
    assert(bulletin);
    assert.equal(Boolean(bulletin.is_pinned), false, 'The string false must produce an unpinned bulletin.');
    await request(`/api/curator/updates/${result.data.updateId}`, { method: 'DELETE', headers: { Cookie: curatorCookie } });
    assert.equal((await request('/api/curator/updates/not-a-real-id', { method: 'DELETE', headers: { Cookie: curatorCookie } })).response.status, 404);
    console.log('✓ Curator APIs validate booleans/URLs and report missing records accurately.');

    // Member input validation, real zero progress and partial updates.
    result = await request('/api/curator/members', {
        method: 'POST',
        headers: { Cookie: curatorCookie },
        body: { name: 'Invalid Avatar', avatar_url: 'javascript:alert(1)' }
    });
    assert.equal(result.response.status, 400, 'Unsafe avatar schemes must be rejected.');
    result = await request('/api/curator/members', {
        method: 'POST',
        headers: { Cookie: curatorCookie },
        body: { name: 'Zero Progress Test', display_name: 'Zero Progress', role: 'Member', handle: '@zero-progress' }
    });
    assert.equal(result.response.status, 201);
    const memberId = result.data.memberId;
    const secretCode = result.data.secretCode;
    const memberLogin = await request('/api/member/access', {
        method: 'POST',
        body: { secretCode }
    });
    assert.equal(memberLogin.response.status, 200);
    const memberCookie = memberLogin.response.headers.get('set-cookie').split(';')[0];

    result = await request('/api/member/reading', {
        method: 'POST',
        headers: { Cookie: memberCookie },
        body: { progress: 0 }
    });
    assert.equal(result.response.status, 200);
    result = await request('/api/member/me', { headers: { Cookie: memberCookie } });
    assert.equal(result.data.reading.progress, 0);
    assert.equal(result.data.bookshelf[0].progress, 0, 'Zero must not be replaced with a display fallback.');
    await request('/api/member/reading', {
        method: 'POST',
        headers: { Cookie: memberCookie },
        body: { book_title: 'Renamed book' }
    });
    result = await request('/api/member/me', { headers: { Cookie: memberCookie } });
    assert.equal(result.data.reading.progress, 0, 'A partial title update must preserve existing progress.');
    assert.equal(result.data.reading.bookTitle, 'Renamed book');
    result = await request('/api/curator/members/not-a-real-id', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { bio: 'missing' }
    });
    assert.equal(result.response.status, 404);
    await request(`/api/curator/members/${memberId}`, { method: 'DELETE', headers: { Cookie: curatorCookie } });
    console.log('✓ Member validation preserves zero progress and prevents false success for missing records.');

    // Verify rate limiting is actually active on a mounted /api route. This is last,
    // since the limiter intentionally blocks this test client's remaining requests.
    let received429 = false;
    for (let i = 0; i < 200; i += 1) {
        const { response } = await request('/api/health', { cache: 'no-store' });
        if (response.status === 429) {
            received429 = true;
            break;
        }
    }
    assert.equal(received429, true, 'Mounted API requests must eventually be rate limited.');
    console.log('✓ The /api rate limiter runs and returns 429 when the client exceeds its quota.');
}

run().catch(error => {
    console.error('Functional regression checks failed:', error);
    process.exit(1);
});

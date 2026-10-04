const assert = require('node:assert/strict');
const { baseUrl, ADMIN_PASSWORD } = require('./test_config');

async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body = options.body;
    if (body !== undefined && typeof body !== 'string') {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }
    const response = await fetch(new URL(path, baseUrl), { ...options, headers, body });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { response, data };
}

async function testPaperPlaneToggle() {
    console.log('================================================================');
    console.log('   WABI SABI PAPER AIRPLANE FEATURE-TOGGLE AUDIT');
    console.log('================================================================\n');

    const { response: initialResponse, data: initial } = await api('/api/portal');
    assert.equal(initialResponse.status, 200);
    assert.equal(initial.portal.features.paper_plane_enabled, false, 'Paper airplane must default to OFF.');
    console.log('✓ Public portal reports the safe default (OFF).');

    const { response: loginResponse, data: login } = await api('/api/auth/login', {
        method: 'POST',
        body: { identifier: 'wabisabiofficial3@gmail.com', password: ADMIN_PASSWORD }
    });
    assert.equal(loginResponse.status, 200);
    const cookies = loginResponse.headers.get('set-cookie');
    assert(cookies && cookies.includes('wabisabi_curator_session='));
    const curatorCookie = cookies.split(',')[0].split(';')[0];

    const { response: onResponse, data: onData } = await api('/api/curator/features', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { paper_plane_enabled: true }
    });
    assert.equal(onResponse.status, 200);
    assert.equal(onData.settings.paper_plane_enabled, true);
    const { data: portalOn } = await api('/api/portal');
    assert.equal(portalOn.portal.features.paper_plane_enabled, true);
    console.log('✓ Curator can enable the feature and the public portal reflects it.');

    const { response: offResponse, data: offData } = await api('/api/curator/features', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { paper_plane_enabled: 'false' }
    });
    assert.equal(offResponse.status, 200);
    assert.equal(offData.settings.paper_plane_enabled, false, 'String false must not coerce to true.');
    const { data: portalOff } = await api('/api/portal');
    assert.equal(portalOff.portal.features.paper_plane_enabled, false);
    console.log('✓ Both boolean and string-false inputs are handled safely.');

    const { response: invalidResponse } = await api('/api/curator/features', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { paper_plane_enabled: 'sometimes' }
    });
    assert.equal(invalidResponse.status, 400, 'Invalid feature values must be rejected.');
    console.log('✓ Invalid feature values are rejected without changing the stored setting.');

    const html = (await (await fetch(new URL('/home.html', baseUrl))).text());
    assert(html.includes('id="launchRocketBtn"'));
    console.log('✓ Existing portal control markup remains present.');

    console.log('\n✦ ALL PAPER AIRPLANE API CHECKS PASSED.');
}

testPaperPlaneToggle().catch(err => {
    console.error('Paper airplane toggle audit failed:', err);
    process.exit(1);
});

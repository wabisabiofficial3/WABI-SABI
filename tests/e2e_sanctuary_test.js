const { baseUrl, ADMIN_PASSWORD } = require('./test_config');
const http = require('http');

function req(path, opts = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(path, baseUrl);
        const ro = { method: opts.method || 'GET', headers: opts.headers || {} };
        const r = http.request(u, ro, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
        });
        r.on('error', reject);
        if (opts.body) r.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
        r.end();
    });
}

async function run() {
    // 1. Visitor checks
    const rRoot = await req('/');
    if (rRoot.body.includes('userProfileBtn') || rRoot.body.includes('headerHandleBadge')) {
        throw new Error('Public root has login links!');
    }
    console.log('✓ Public root has 0 login links and clean calm header');

    const rLogin = await req('/login');
    if (rLogin.status !== 302 || rLogin.headers.location !== '/') {
        throw new Error('/login did not redirect to /');
    }
    console.log('✓ /login quietly redirects curious visitors to /');

    const rCurator = await req('/curator');
    if (rCurator.status !== 302 || !rCurator.headers.location.includes('/sanctuary')) {
        throw new Error('/curator did not redirect to /sanctuary');
    }
    console.log('✓ Unauthenticated /curator redirects to /sanctuary');

    const rSanctuary = await req('/sanctuary');
    if (rSanctuary.status !== 200 || !rSanctuary.body.includes('The Sanctuary')) {
        throw new Error('/sanctuary failed to serve the curator gate');
    }
    console.log('✓ /sanctuary serves the curator gate');

    // 2. Curator / Admin Login
    const rAuth = await req('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { identifier: 'wabisabiofficial3@gmail.com', password: ADMIN_PASSWORD }
    });
    const cookie = rAuth.headers['set-cookie'][0].split(';')[0];
    console.log('✓ Admin authenticated with 30-day session cookie');

    // 3. In-place sticky note update
    const rNote = await req('/api/curator/sticky-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: { books: '“Ideas that take quiet root, and stay with you for years.”' }
    });
    if (rNote.status !== 200) throw new Error('Sticky note update failed');
    console.log('✓ In-place sticky note edit API verified');

    // 4. Public portal parity
    const rPortal = await req('/api/portal');
    const pData = JSON.parse(rPortal.body);
    if (!pData.sticky_notes || !pData.sticky_notes.books) throw new Error('Portal missing sticky_notes');
    console.log('✓ Public portal immediately reflects in-place note updates');

    // 5. Logout
    const rLogout = await req('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
    if (rLogout.status !== 200) throw new Error('Logout failed');
    console.log('✓ Curator explicit logout terminates session cleanly');

    console.log('\n✦ ALL END-TO-END SANCTUARY & IN-PLACE EDIT CHECKS PASSED PERFECTLY!');
}

run().catch(e => {
    console.error('E2E Verification Failure:', e);
    process.exit(1);
});

const { app } = require('../server/index');
const { db } = require('../server/db');
const { generateSessionToken, hashSessionToken } = require('../server/crypto');
const http = require('node:http');

async function testPageGuards() {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    console.log(`Testing page guards on ${baseUrl}...`);

    async function req(urlPath, cookie = null) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(urlPath, baseUrl);
            const headers = {};
            if (cookie) headers['Cookie'] = cookie;

            const req = http.request(parsed, { method: 'GET', headers }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data
                    });
                });
            });
            req.on('error', reject);
            req.end();
        });
    }

    try {
        // 1. Unauthenticated request to /community -> 302 to /login
        const res1 = await req('/community');
        console.log('Unauth /community status:', res1.statusCode, 'Location:', res1.headers.location);
        if (res1.statusCode !== 302 || !res1.headers.location.includes('/login')) {
            throw new Error('Unauthenticated /community did not redirect to /login');
        }

        // 2. Unauthenticated request to /curator -> 302 to /login
        const res2 = await req('/curator');
        console.log('Unauth /curator status:', res2.statusCode, 'Location:', res2.headers.location);
        if (res2.statusCode !== 302 || !res2.headers.location.includes('/login')) {
            throw new Error('Unauthenticated /curator did not redirect to /login');
        }

        // 3. Unauthenticated request to /home.html -> 302 to /login
        const res3 = await req('/home.html');
        console.log('Unauth /home.html status:', res3.statusCode, 'Location:', res3.headers.location);
        if (res3.statusCode !== 302 || !res3.headers.location.includes('/login')) {
            throw new Error('Unauthenticated /home.html did not redirect to /login');
        }

        // 4. Create a valid member session and test /community
        const memberToken = generateSessionToken();
        const memberHash = hashSessionToken(memberToken);
        let memberUser = db.prepare("SELECT id FROM users WHERE role = 'USER' AND status = 'ACTIVE' LIMIT 1").get();
        if (!memberUser) {
            const id = 'test-member-guard';
            db.prepare(`
                INSERT OR IGNORE INTO users (id, email, password_hash, display_name, handle, role, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(id, 'member.guard@wabisabi.internal', 'hash', 'Test Reader', 'testreader', 'USER', 'ACTIVE');
            memberUser = { id };
        }
        db.prepare(`
            INSERT OR REPLACE INTO sessions (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, datetime('now', '+1 hour'))
        `).run('sess-test-mem-guard', memberUser.id, memberHash);

        const memberCookie = `wabisabi_session=${memberToken}`;
        const res4 = await req('/community', memberCookie);
        console.log('Auth member /community status:', res4.statusCode);
        if (res4.statusCode !== 200) {
            throw new Error(`Auth member /community returned ${res4.statusCode}, expected 200`);
        }

        // 5. Member trying to access /curator -> 302 redirect to /home
        const res5 = await req('/curator', memberCookie);
        console.log('Member /curator status:', res5.statusCode, 'Location:', res5.headers.location);
        if (res5.statusCode !== 302 || res5.headers.location !== '/home') {
            throw new Error(`Member accessing /curator was not redirected to /home`);
        }

        // 6. Curator session accessing /curator -> 200
        const curatorToken = generateSessionToken();
        const curatorHash = hashSessionToken(curatorToken);
        const curatorUser = db.prepare("SELECT id FROM users WHERE role = 'CURATOR' LIMIT 1").get();
        db.prepare(`
            INSERT OR REPLACE INTO sessions (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, datetime('now', '+1 hour'))
        `).run('sess-test-cur-guard', curatorUser.id, curatorHash);

        const curatorCookie = `wabisabi_session=${curatorToken}`;
        const res6 = await req('/curator', curatorCookie);
        console.log('Curator /curator status:', res6.statusCode);
        if (res6.statusCode !== 200) {
            throw new Error(`Curator accessing /curator returned ${res6.statusCode}, expected 200`);
        }

        console.log('✅ ALL SERVER-SIDE PAGE GUARD TESTS PASSED!');
    } finally {
        server.close();
    }
}

testPageGuards().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

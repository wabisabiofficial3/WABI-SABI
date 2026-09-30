const { app } = require('../server/index');
const { db } = require('../server/db');
const { generateSessionToken, hashSessionToken } = require('../server/crypto');
const http = require('node:http');

async function testContentCms() {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    console.log(`Testing /api/content CMS endpoints on ${baseUrl}...`);

    async function req(urlPath, method = 'GET', body = null, cookie = null) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(urlPath, baseUrl);
            const headers = { 'Accept': 'application/json' };
            if (body) headers['Content-Type'] = 'application/json';
            if (cookie) headers['Cookie'] = cookie;

            const req = http.request(parsed, { method, headers }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let json = null;
                    try { json = JSON.parse(data); } catch(e) {}
                    resolve({ statusCode: res.statusCode, data: json || data });
                });
            });
            req.on('error', reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    try {
        // 1. GET /api/content (Public)
        const res1 = await req('/api/content');
        if (res1.statusCode !== 200 || !res1.data.success || !res1.data.content.featuredBook) {
            throw new Error(`GET /api/content failed: status ${res1.statusCode}`);
        }
        console.log('✓ Public GET /api/content returned featured book:', res1.data.content.featuredBook.title);

        // 2. PUT /api/content/featured-book without auth -> 401
        const res2 = await req('/api/content/featured-book', 'PUT', { title: 'Test Book', author: 'Author' });
        if (res2.statusCode !== 401) {
            throw new Error(`Expected 401 for unauthenticated PUT, got ${res2.statusCode}`);
        }
        console.log('✓ Unauthenticated PUT rejected with 401');

        // 3. Member cookie trying to PUT -> 403
        const memberToken = generateSessionToken();
        const memberHash = hashSessionToken(memberToken);
        let memberUser = db.prepare("SELECT id FROM users WHERE role = 'USER' AND status = 'ACTIVE' LIMIT 1").get();
        if (!memberUser) {
            const id = 'test-member-cms';
            db.prepare(`
                INSERT OR IGNORE INTO users (id, email, password_hash, display_name, handle, role, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(id, 'member.cms@wabisabi.internal', 'hash', 'Test Reader', 'testreader', 'USER', 'ACTIVE');
            memberUser = { id };
        }
        db.prepare(`
            INSERT OR REPLACE INTO sessions (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, datetime('now', '+1 hour'))
        `).run('sess-test-mem-cms', memberUser.id, memberHash);

        const res3 = await req('/api/content/featured-book', 'PUT', { title: 'Test Book', author: 'Author' }, `wabisabi_session=${memberToken}`);
        if (res3.statusCode !== 403) {
            throw new Error(`Expected 403 for member PUT, got ${res3.statusCode}`);
        }
        console.log('✓ Member PUT rejected with 403 Forbidden');

        // 4. Curator cookie updating featured book -> 200 & verified in DB
        const curatorToken = generateSessionToken();
        const curatorHash = hashSessionToken(curatorToken);
        const curatorUser = db.prepare("SELECT id FROM users WHERE role = 'CURATOR' LIMIT 1").get();
        db.prepare(`
            INSERT OR REPLACE INTO sessions (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, datetime('now', '+1 hour'))
        `).run('sess-test-cur-cms', curatorUser.id, curatorHash);

        const newBook = {
            title: 'The Catcher in the Rye',
            author: 'J.D. Salinger',
            quote: 'I like it when somebody gets excited about something. It’s nice.',
            readers: 1850,
            discussionDate: 'Oct 12, 2026'
        };

        const res4 = await req('/api/content/featured-book', 'PUT', newBook, `wabisabi_session=${curatorToken}`);
        if (res4.statusCode !== 200 || !res4.data.success) {
            throw new Error(`Curator PUT /api/content/featured-book failed: ${JSON.stringify(res4.data)}`);
        }
        console.log('✓ Curator updated featured book successfully to:', res4.data.featuredBook.title);

        // 5. Subsequent public GET /api/content returns new book
        const res5 = await req('/api/content');
        if (res5.data.content.featuredBook.title !== 'The Catcher in the Rye') {
            throw new Error(`Site content did not reflect updated book title: ${res5.data.content.featuredBook.title}`);
        }
        console.log('✓ Server-wide GET /api/content confirmed update persisted:', res5.data.content.featuredBook.title);

        // 6. Test Salon update
        const newSalon = {
            title: 'Holden, Solitude & Modern Phoniness',
            detail: 'Central Park & Museum Sequence • 8:00 PM • The Table Room',
            month: 'Oct',
            day: '12',
            attendees: 412
        };
        const res6 = await req('/api/content/salon', 'PUT', newSalon, `wabisabi_session=${curatorToken}`);
        if (res6.statusCode !== 200 || !res6.data.success) {
            throw new Error(`Curator PUT /api/content/salon failed: ${JSON.stringify(res6.data)}`);
        }
        console.log('✓ Curator updated upcoming salon successfully to:', res6.data.currentSalon.title);

        console.log('✅ ALL CONTENT CMS API & PERSISTENCE TESTS PASSED!');
    } finally {
        server.close();
    }
}

testContentCms().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

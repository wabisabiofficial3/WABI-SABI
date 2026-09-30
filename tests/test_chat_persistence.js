const { app } = require('../server/index');
const { db } = require('../server/db');
const { generateSessionToken, hashSessionToken } = require('../server/crypto');
const http = require('node:http');

async function testChatPersistence() {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    console.log(`Testing /api/chat persistence on ${baseUrl}...`);

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
        // 1. GET /api/chat/messages?week=4
        const res1 = await req('/api/chat/messages?week=4');
        if (res1.statusCode !== 200 || !res1.data.success || !Array.isArray(res1.data.messages)) {
            throw new Error(`GET /api/chat/messages failed: ${JSON.stringify(res1.data)}`);
        }
        console.log(`✓ Fetched ${res1.data.messages.length} existing Week 4 message(s)`);
        const initialCount = res1.data.messages.length;

        // 2. Unauthenticated POST -> 401
        const res2 = await req('/api/chat/messages', 'POST', { content: 'Hello table', week: 4 });
        if (res2.statusCode !== 401) {
            throw new Error(`Expected 401 for unauthenticated message post, got ${res2.statusCode}`);
        }
        console.log('✓ Unauthenticated chat post rejected with 401');

        // 3. Authenticated member POST -> 201
        const memberToken = generateSessionToken();
        const memberHash = hashSessionToken(memberToken);
        let memberUser = db.prepare("SELECT id, display_name FROM users WHERE role = 'USER' AND status = 'ACTIVE' LIMIT 1").get();
        if (!memberUser) {
            const id = 'test-member-chat';
            db.prepare(`
                INSERT OR IGNORE INTO users (id, email, password_hash, display_name, handle, role, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(id, 'member.chat@wabisabi.internal', 'hash', 'Test Reader', 'testreader', 'USER', 'ACTIVE');
            memberUser = { id, display_name: 'Test Reader' };
        }
        db.prepare(`
            INSERT OR REPLACE INTO sessions (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, datetime('now', '+1 hour'))
        `).run('sess-test-chat-mem', memberUser.id, memberHash);

        const newMsgPayload = {
            content: "There's a quiet honesty in Holden's voice that modern internet discourse often lacks.",
            week: 4
        };

        const res3 = await req('/api/chat/messages', 'POST', newMsgPayload, `wabisabi_session=${memberToken}`);
        if (res3.statusCode !== 201 || !res3.data.success || !res3.data.message.id) {
            throw new Error(`Failed to post authenticated chat message: ${JSON.stringify(res3.data)}`);
        }
        const createdMsgId = res3.data.message.id;
        console.log(`✓ Member posted message successfully, assigned ID: ${createdMsgId}`);

        // 4. Like message via POST /api/chat/messages/:id/like
        const res4 = await req(`/api/chat/messages/${encodeURIComponent(createdMsgId)}/like`, 'POST');
        if (res4.statusCode !== 200 || res4.data.likesCount !== 1) {
            throw new Error(`Expected likesCount 1, got: ${JSON.stringify(res4.data)}`);
        }
        console.log('✓ Liked message, updated likesCount = 1');

        // 5. Subsequent GET confirms message exists in stream with like count 1
        const res5 = await req('/api/chat/messages?week=4');
        if (res5.data.messages.length !== initialCount + 1) {
            throw new Error(`Message stream count did not increase: ${res5.data.messages.length}`);
        }
        const found = res5.data.messages.find(m => m.id === createdMsgId);
        if (!found || found.likesCount !== 1) {
            throw new Error(`Created message not found or likes count incorrect in stream: ${JSON.stringify(found)}`);
        }
        console.log('✓ Verified message persists in SQLite database and loads into stream across requests');

        console.log('✅ ALL TABLE ROOM CHAT PERSISTENCE TESTS PASSED!');
    } finally {
        server.close();
    }
}

testChatPersistence().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

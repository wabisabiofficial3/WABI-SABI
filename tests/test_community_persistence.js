const { app } = require('../server/index');
const { db } = require('../server/db');
const { generateSessionToken, hashSessionToken } = require('../server/crypto');
const http = require('node:http');

async function testCommunityPersistence() {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    console.log(`Testing /api/community persistence on ${baseUrl}...`);

    async function req(urlPath, method = 'GET', body = null, cookie = null) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(urlPath, baseUrl);
            const headers = { 'Accept': 'application/json' };
            if (body) headers['Content-Type'] = 'application/json';
            if (cookie) headers['Cookie'] = cookie;

            const request = http.request(parsed, { method, headers }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let json = null;
                    try { json = JSON.parse(data); } catch(e) {}
                    resolve({ statusCode: res.statusCode, data: json || data });
                });
            });
            request.on('error', reject);
            if (body) request.write(JSON.stringify(body));
            request.end();
        });
    }

    try {
        // 1. Setup authenticated session for test user
        let memberUser = db.prepare("SELECT id, display_name, handle FROM users WHERE role = 'USER' AND status = 'ACTIVE' LIMIT 1").get();
        if (!memberUser) {
            const id = 'test-member-comm';
            db.prepare(`
                INSERT OR IGNORE INTO users (id, email, password_hash, display_name, handle, role, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(id, 'member.comm@wabisabi.internal', 'hash', 'Test Reader', 'testreader', 'USER', 'ACTIVE');
            memberUser = { id, display_name: 'Test Reader', handle: 'testreader' };
        }

        const memberToken = generateSessionToken();
        const memberHash = hashSessionToken(memberToken);
        db.prepare(`
            INSERT INTO sessions (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, datetime('now', '+1 hour'))
        `).run('sess-test-comm-mem-' + Date.now(), memberUser.id, memberHash);
        const memberCookie = `wabisabi_session=${memberToken}`;

        // 2. Fetch Poll details
        console.log('1. Testing GET /api/community/poll...');
        const pollRes = await req('/api/community/poll?pollId=poll-week-04', 'GET', null, memberCookie);
        if (pollRes.statusCode !== 200 || !pollRes.data.success || !Array.isArray(pollRes.data.choices)) {
            throw new Error(`GET /api/community/poll failed: ${JSON.stringify(pollRes.data)}`);
        }
        console.log(`   ✓ Poll loaded. Total votes: ${pollRes.data.totalVotes}, Choices: ${pollRes.data.choices.length}`);

        // 3. Post a vote
        console.log('2. Testing POST /api/community/poll/vote...');
        const voteRes = await req('/api/community/poll/vote', 'POST', {
            pollId: 'poll-week-04',
            choiceIndex: 2
        }, memberCookie);

        if (voteRes.statusCode !== 200 || !voteRes.data.success) {
            throw new Error(`POST /api/community/poll/vote failed: ${JSON.stringify(voteRes.data)}`);
        }
        console.log(`   ✓ Vote registered! userVotedIndex: ${voteRes.data.userVotedIndex}`);
        console.log(`   ✓ Vote breakdown: ${JSON.stringify(voteRes.data.choices.map(c => ({ text: c.text, pct: c.percentage + '%' })))}`);

        // 4. Test duplicate vote handling (switching to choice 0)
        console.log('3. Testing vote update to choice 0...');
        const dupVoteRes = await req('/api/community/poll/vote', 'POST', {
            pollId: 'poll-week-04',
            choiceIndex: 0
        }, memberCookie);
        if (dupVoteRes.statusCode !== 200 || !dupVoteRes.data.success || dupVoteRes.data.userVotedIndex !== 0) {
            throw new Error(`Duplicate vote handling failed: ${JSON.stringify(dupVoteRes.data)}`);
        }
        console.log(`   ✓ Vote cleanly updated to index 0! New total: ${dupVoteRes.data.totalVotes}`);

        // 5. Fetch thoughts
        console.log('4. Testing GET /api/community/thoughts...');
        const thoughtsRes = await req('/api/community/thoughts', 'GET', null, memberCookie);
        if (thoughtsRes.statusCode !== 200 || !thoughtsRes.data.success || !Array.isArray(thoughtsRes.data.thoughts)) {
            throw new Error(`GET /api/community/thoughts failed: ${JSON.stringify(thoughtsRes.data)}`);
        }
        console.log(`   ✓ Retrieved ${thoughtsRes.data.thoughts.length} discussion thoughts`);
        const initialThoughtsCount = thoughtsRes.data.thoughts.length;

        // 6. Post new thought
        console.log('5. Testing POST /api/community/thoughts...');
        const testContent = 'The whisper in the street scene reminds us that intimacy is ephemeral and quiet.';
        const postThoughtRes = await req('/api/community/thoughts', 'POST', {
            topic_id: 'week-04-lost-in-translation',
            content: testContent
        }, memberCookie);

        if (postThoughtRes.statusCode !== 201 || !postThoughtRes.data.success || !postThoughtRes.data.thought) {
            throw new Error(`POST /api/community/thoughts failed: ${JSON.stringify(postThoughtRes.data)}`);
        }
        const createdThought = postThoughtRes.data.thought;
        console.log(`   ✓ Thought persisted! ID: ${createdThought.id}, User: ${createdThought.name} (@${createdThought.handle})`);

        // 7. Verify thought count increased
        const thoughtsRes2 = await req('/api/community/thoughts', 'GET', null, memberCookie);
        if (thoughtsRes2.data.thoughts.length !== initialThoughtsCount + 1) {
            throw new Error(`Expected thoughts count ${initialThoughtsCount + 1}, got ${thoughtsRes2.data.thoughts.length}`);
        }
        console.log(`   ✓ Verified thoughts count incremented to ${thoughtsRes2.data.thoughts.length}`);

        // 8. Like the newly created thought
        console.log('6. Testing POST /api/community/thoughts/:id/like...');
        const likeRes = await req(`/api/community/thoughts/${createdThought.id}/like`, 'POST', null, memberCookie);
        if (likeRes.statusCode !== 200 || !likeRes.data.success || likeRes.data.likesCount !== 1) {
            throw new Error(`POST /api/community/thoughts/:id/like failed: ${JSON.stringify(likeRes.data)}`);
        }
        console.log(`   ✓ Thought liked! Likes count: ${likeRes.data.likesCount}`);

        console.log('\n--- ALL COMMUNITY PERSISTENCE TESTS PASSED (6/6) ---');
    } finally {
        server.close();
    }
}

testCommunityPersistence().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});

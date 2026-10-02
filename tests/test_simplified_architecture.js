/**
 * Wabi Sabi — Simplified Architecture & 3-Pillar Coordination Verification Test Suite
 * Validates:
 * 1. Pillar 1: Announcements (Weekly Theme, Reading, Gathering, Discussion Points, Important Notes, Bulletins)
 * 2. Pillar 2: Community (People Directory with Profile Pics, Names, Roles, Handles)
 * 3. Pillar 3: Connect (External Platforms: Chat, Book Drive, Location, Socials)
 * 4. Zero-Auth Visitor Access: Everyone enters directly without account/login.
 * 5. Curator RBAC: Only Likith, Sarvasree, Dhanush can log in and manage the 3 pillars.
 */

const assert = require('assert');
const http = require('http');
const { startServer } = require('../server/index');
const { db } = require('../server/db');

let server;
let baseUrl;

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const reqOptions = {
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(url, reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);
        if (options.body) {
            req.write(typeof options.body === 'object' ? JSON.stringify(options.body) : options.body);
        }
        req.end();
    });
}

async function runTests() {
    console.log('\n--- 1. Starting Wabi Sabi Server on Ephemeral Port ---');
    server = await startServer(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`✓ Server running at ${baseUrl}`);

    try {
        console.log('\n--- 2. Public Portal Access (Zero-Auth Visitor Verification) ---');
        // Test root endpoint /
        const resRoot = await request('/');
        assert.strictEqual(resRoot.statusCode, 200, 'Root / should be publicly accessible without login');
        assert(typeof resRoot.body === 'string' && resRoot.body.includes('Wabi Sabi'), 'Root should serve public portal HTML');
        console.log('✓ Public visitors enter / directly without account or login');

        // Test public API endpoint /api/portal
        const resPortal = await request('/api/portal');
        assert.strictEqual(resPortal.statusCode, 200, '/api/portal should return 200 OK');
        assert.strictEqual(resPortal.body.success, true);
        
        // Check 3 pillars in API response
        assert(resPortal.body.portal.announcements, 'Should return announcements pillar');
        assert(resPortal.body.portal.announcements.weekly_theme.theme, 'Should return weekly theme');
        assert(resPortal.body.portal.announcements.reading.title, 'Should return weekly reading');
        assert(resPortal.body.portal.announcements.gathering.location, 'Should return gathering location');
        assert(Array.isArray(resPortal.body.portal.announcements.discussion_points), 'Should return discussion points');
        assert(resPortal.body.portal.announcements.important_notes, 'Should return important notes');

        assert(resPortal.body.portal.community, 'Should return community pillar');
        assert(Array.isArray(resPortal.body.portal.community.members), 'Should return members directory');
        assert(resPortal.body.portal.community.members.length >= 3, 'Should contain seeded members');

        assert(resPortal.body.portal.connect, 'Should return connect pillar');
        assert(resPortal.body.portal.connect.links.community_chat_url, 'Should return external chat link');
        assert(resPortal.body.portal.connect.links.book_drive_url, 'Should return external book drive link');
        console.log('✓ Public portal API serves all 3 pillars (Announcements, Community, Connect) with zero auth');

        console.log('\n--- 3. Curator Route Protection & RBAC ---');
        // Unauthenticated access to /curator page must redirect to /login
        const resCuratorPage = await request('/curator');
        assert.strictEqual(resCuratorPage.statusCode, 302, 'Unauthenticated /curator should redirect');
        assert(resCuratorPage.headers.location.includes('/sanctuary'), 'Should redirect to /sanctuary');
        console.log('✓ Public visitors are strictly blocked from /curator and redirected to /sanctuary');

        // Unauthenticated access to /api/curator/updates must return 401 Unauthorized
        const resUnauthApi = await request('/api/curator/updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { title: 'Hacked', content: 'Unauthorized' }
        });
        assert.strictEqual(resUnauthApi.statusCode, 401, 'Unauthenticated API call must be 401');
        assert.strictEqual(resUnauthApi.body.success, false);
        console.log('✓ Curator API endpoints strictly require curator authentication');

        console.log('\n--- 4. Curator Login (Only the 3 Curators) ---');
        // Attempt login with unauthorized credentials
        const resBadLogin = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { identifier: 'intruder@example.com', password: 'randompassword' }
        });
        assert.strictEqual(resBadLogin.statusCode, 401, 'Non-curator login must be rejected');
        console.log('✓ Non-curator login requests rejected with 401');

        // Login as Wabi Sabi Admin (The single authorized Admin account)
        const resAdminLogin = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { identifier: 'wabisabiofficial3@gmail.com', password: 'DsL@678_' }
        });
        assert.strictEqual(resAdminLogin.statusCode, 200, 'Admin login should succeed');
        assert.strictEqual(resAdminLogin.body.success, true);
        assert.strictEqual(resAdminLogin.body.curator.handle, 'admin');

        // Extract session cookie
        const setCookieHeader = resAdminLogin.headers['set-cookie'];
        assert(setCookieHeader && setCookieHeader.length > 0, 'Login must set session cookie');
        const cookie = setCookieHeader.map(c => c.split(';')[0]).join('; ');
        console.log('✓ Admin authenticated successfully and received session cookie');

        // Verify session via /api/auth/me
        const resMe = await request('/api/auth/me', {
            headers: { Cookie: cookie }
        });
        assert.strictEqual(resMe.statusCode, 200);
        assert.strictEqual(resMe.body.curator.handle, 'admin');
        console.log('✓ Session verification /api/auth/me confirms authenticated admin identity');

        console.log('\n--- 5. Curator Management Capabilities (All 3 Pillars) ---');
        // Pillar 1: Update Announcements (Theme, Reading, Gathering, Discussion Points, Notes)
        const resUpdateAnnouncements = await request('/api/curator/announcements', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: {
                weekly_theme: {
                    theme: 'Solitude & Creativity',
                    subtitle: 'Finding solace in quiet hours.'
                },
                this_weeks_reading: {
                    title: 'The Stranger',
                    author: 'Albert Camus',
                    notes: 'Read chapters 1 through 4.',
                    drive_url: 'https://drive.google.com/test-stranger'
                },
                gathering: {
                    date: 'Saturday, 11 October',
                    time: '4:30 PM',
                    location: 'MRDU Courtyard Garden',
                    maps_url: 'https://maps.google.com/test-garden'
                },
                discussion_points: [
                    'What is your relationship to solitude?',
                    'Does isolation hinder or spark art?'
                ],
                important_notes: 'Please bring your notebooks and a warm beverage.'
            }
        });
        assert.strictEqual(resUpdateAnnouncements.statusCode, 200);
        assert.strictEqual(resUpdateAnnouncements.body.success, true);
        console.log('✓ Curator updated Pillar 1 (Announcements: Theme, Reading, Gathering, Discussion, Notes)');

        // Post a bulletin update
        const resNewUpdate = await request('/api/curator/updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: {
                title: 'Autumn Volume Announced',
                content: 'Welcome to our autumn schedule.',
                is_pinned: 1
            }
        });
        assert.strictEqual(resNewUpdate.statusCode, 201);
        const updateId = resNewUpdate.body.updateId;
        console.log('✓ Curator posted a new bulletin notice');

        // Pillar 2: Community Members Directory Management
        // Add a new member
        const resAddMember = await request('/api/curator/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: {
                name: 'Ananya Rao',
                role: 'Reader',
                handle: '@ananya',
                avatar_url: '../assets/avatar_ishita.jpg',
                bio: 'Passionate about magical realism and poetry',
                display_order: 6
            }
        });
        assert.strictEqual(resAddMember.statusCode, 201);
        assert.strictEqual(resAddMember.body.success, true);
        const memberId = resAddMember.body.memberId;
        console.log('✓ Curator added a new member to Pillar 2 (Community Directory)');

        // Pillar 3: Connect Links Update
        const resUpdateConnect = await request('/api/curator/connect', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: {
                community_chat_url: 'https://chat.whatsapp.com/test-wabi-chat',
                book_drive_url: 'https://drive.google.com/test-wabi-drive',
                meeting_maps_url: 'https://maps.google.com/test-wabi-maps',
                instagram_url: 'https://instagram.com/wabisabibookclub',
                whatsapp_url: 'https://chat.whatsapp.com/test-wabi-wa',
                discord_url: 'https://discord.gg/wabisabi'
            }
        });
        assert.strictEqual(resUpdateConnect.statusCode, 200);
        assert.strictEqual(resUpdateConnect.body.success, true);
        console.log('✓ Curator updated Pillar 3 (Connect External Links)');

        // Verify that public portal reflects all updates immediately
        const resPublicCheck = await request('/api/portal');
        assert.strictEqual(resPublicCheck.statusCode, 200);
        const portal = resPublicCheck.body.portal;

        assert.strictEqual(portal.announcements.weekly_theme.theme, 'Solitude & Creativity');
        assert.strictEqual(portal.announcements.reading.title, 'The Stranger');
        assert.strictEqual(portal.announcements.gathering.location, 'MRDU Courtyard Garden');
        assert(portal.announcements.discussion_points.includes('What is your relationship to solitude?'));
        assert.strictEqual(portal.announcements.important_notes, 'Please bring your notebooks and a warm beverage.');

        const addedMember = portal.community.members.find(m => m.id === memberId);
        assert(addedMember, 'New member must be present in public community directory');
        assert.strictEqual(addedMember.name, 'Ananya Rao');

        assert.strictEqual(portal.connect.links.community_chat_url, 'https://chat.whatsapp.com/test-wabi-chat');
        assert.strictEqual(portal.connect.links.instagram_url, 'https://instagram.com/wabisabibookclub');
        console.log('✓ Public portal immediately renders all curator changes across all 3 pillars');

        // Cleanup: remove member and bulletin
        const resDelMem = await request(`/api/curator/members/${memberId}`, {
            method: 'DELETE',
            headers: { Cookie: cookie }
        });
        assert.strictEqual(resDelMem.statusCode, 200);
        console.log('✓ Curator deleted test member');

        const resDelUpd = await request(`/api/curator/updates/${updateId}`, {
            method: 'DELETE',
            headers: { Cookie: cookie }
        });
        assert.strictEqual(resDelUpd.statusCode, 200);
        console.log('✓ Curator deleted test bulletin');

        console.log('\n--- 6. Legacy Route Redirects ---');
        const legacyRoutes = ['/join', '/community', '/application-status', '/table-room'];
        for (const route of legacyRoutes) {
            const resLegacy = await request(route);
            assert.strictEqual(resLegacy.statusCode, 302, `${route} should redirect to /`);
            assert.strictEqual(resLegacy.headers.location, '/', `${route} should redirect to /`);
        }
        console.log('✓ All legacy membership/chat routes gracefully redirect to the public portal');

        console.log('\n================================================================');
        console.log('   ✦ ALL 3-PILLAR WABI SABI PORTAL TESTS PASSED CLEANLY! ✦');
        console.log('================================================================\n');

    } finally {
        if (server) {
            server.close();
        }
    }
}

runTests().catch(err => {
    console.error('Test failed:', err);
    if (server) server.close();
    process.exit(1);
});

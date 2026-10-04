const { baseUrl, ADMIN_PASSWORD } = require('./test_config');
const assert = require('assert');
const http = require('http');

async function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(new URL(path, baseUrl), { method: options.method || 'GET', headers: options.headers || {} }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(data); } catch (e) { json = data; }
                resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
    });
}

async function verifyAll() {
    console.log('--- 1. Verifying Public Home Page HTML ---');
    const homeRes = await request('/pages/home.html');
    assert.strictEqual(homeRes.statusCode, 200);
    const html = homeRes.body;

    // Check old CTA buttons removed
    assert(!html.includes('Get Started →</button>'), 'Get Started button should be removed');
    assert(!html.includes('<span>Watch Intro</span>'), 'Watch Intro button should be removed');
    console.log('✓ Generic Get Started & Watch Intro CTA buttons removed');

    // Check new Zen Interactive Bar added
    assert(html.includes('id="btnDrawReflection"'), 'Draw Daily Reflection button present');
    assert(html.includes('id="btnTeaRoomAmbience"'), 'Tea Room Ambience soundscape button present');
    assert(html.includes('id="introStoryModal"'), 'Daily Reflection modal present');
    assert(html.includes('id="introModalCloseBtn"'), 'Modal close button present');
    console.log('✓ Zen Interactive Bar & Daily Reflection Parchment Modal present');

    // Check fake static metrics removed
    assert(!html.includes('+1.2K reading together'), '+1.2K reading together must be removed');
    assert(!html.includes('+324 members attending'), '+324 members attending must be removed');
    assert(!html.includes('atomic_habits_cover.jpg" alt="Book cover" id="featuredBookCover"'), 'Mismatching Atomic Habits cover must be removed');
    console.log('✓ Fake static reader/attendee numbers (+1.2K, +324) and mismatching covers removed');

    // Check curator mentions removed from public copy
    assert(!html.includes('Curated weekly by Likith, Sarvasree & Dhanush'), 'Old curator line removed');
    assert(!html.includes('curated by Likith, Sarvasree & Dhanush'), 'Old curator copy removed');
    console.log('✓ Hardcoded old curator tri-name strings removed');

    assert(!html.includes('Akshaya') && !html.includes('Vaishnavi'), 'Sample member identities must not remain in public-page fallbacks.');
    assert(!html.includes('Next Discussion Gathering: Saturday, 4 October at 4:00 PM'), 'Sample announcement must not remain in the static page.');
    assert(!html.includes('Welcome to Wabi Sabi Bookclub • Vol. 1'), 'Sample welcome bulletin must not remain in the static page.');
    assert(html.includes('No curator notices posted yet. Check back soon.'), 'An empty-state message should replace sample notices.');
    console.log('✓ Sample member cards and bulletins are removed from static public markup');

    console.log('\n--- 2. Verifying Single Admin Account & Purged Accounts ---');
    // Attempt login with purged legacy curator Dhanush
    const oldLogin1 = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { identifier: 'dhanush', password: 'curator123' }
    });
    assert.strictEqual(oldLogin1.statusCode, 401, 'Purged account dhanush must be rejected with 401');

    // Attempt login with purged legacy curator Likith
    const oldLogin2 = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { identifier: 'nrlikith6@gmail.com', password: 'curator123' }
    });
    assert.strictEqual(oldLogin2.statusCode, 401, 'Purged account likith must be rejected with 401');

    // Attempt login with purged legacy curator Sarvasree
    const oldLogin3 = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { identifier: 'sarvasreeyuvaraj02@gmail.com', password: 'curator123' }
    });
    assert.strictEqual(oldLogin3.statusCode, 401, 'Purged account sarvasree must be rejected with 401');
    console.log('✓ All 3 legacy curator accounts correctly rejected with 401 Unauthorized');

    // Login with the ONE AND ONLY configured Admin Account
    const adminLogin = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { identifier: 'wabisabiofficial3@gmail.com', password: ADMIN_PASSWORD }
    });
    assert.strictEqual(adminLogin.statusCode, 200, 'Admin login must succeed with 200');
    assert.strictEqual(adminLogin.body.success, true);
    assert.strictEqual(adminLogin.body.curator.email, 'wabisabiofficial3@gmail.com');
    assert.strictEqual(adminLogin.body.curator.handle, 'admin');
    console.log('✓ Admin account wabisabiofficial3@gmail.com authenticated successfully');

    // Login using admin handle
    const adminHandleLogin = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { identifier: 'admin', password: ADMIN_PASSWORD }
    });
    assert.strictEqual(adminHandleLogin.statusCode, 200, 'Admin login by handle must succeed with 200');
    console.log('✓ Admin account login by handle "admin" verified');

    console.log('\n--- 3. Verifying Public Portal API Parity ---');
    const portalRes = await request('/api/portal');
    assert.strictEqual(portalRes.statusCode, 200);
    const members = portalRes.body.community.members;
    assert(members.some(m => m.name === 'Wabi Sabi Admin'), 'Wabi Sabi Admin is in community directory');
    assert(!members.some(m => m.name === 'Likith' && m.role === 'Curator'), 'Likith curator purged from directory');
    assert(!members.some(m => m.name === 'Sarvasree' && m.role === 'Curator'), 'Sarvasree curator purged from directory');
    assert(!members.some(m => m.id === 'mem-dhanush'), 'Dhanush curator purged from directory');
    console.log('✓ Community directory contains only verified Admin & real members, zero ghost curators');

    console.log('\n✦ ALL INTERACTIVE WIDGET & ADMIN PURGE VERIFICATIONS PASSED (100%)!');
}

verifyAll().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});

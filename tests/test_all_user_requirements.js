const http = require('http');
const assert = require('node:assert');
const { spawn } = require('child_process');

function req(path, opts = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(path, 'http://127.0.0.1:3000');
        const ro = { method: opts.method || 'GET', headers: opts.headers || {} };
        const r = http.request(u, ro, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                let parsed = d;
                try { parsed = JSON.parse(d); } catch (e) {}
                resolve({ status: res.statusCode, headers: res.headers, body: parsed, rawBody: d });
            });
        });
        r.on('error', reject);
        if (opts.body) {
            const bodyStr = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
            r.write(bodyStr);
        }
        r.end();
    });
}

async function runVerification() {
    console.log('================================================================');
    console.log('   WABI SABI COMPREHENSIVE REQUIREMENTS VERIFICATION');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // 1. Health Endpoints Check (Anti-Sleep for Render)
    // -------------------------------------------------------------
    console.log('► 1. Testing Health Check & Anti-Sleep Endpoints...');
    const healthRes = await req('/health');
    assert.strictEqual(healthRes.status, 200, 'GET /health must return 200');
    assert.strictEqual(healthRes.body.status, 'ok', 'Health status must be "ok"');
    console.log('   ✓ GET /health returned 200 OK:', healthRes.body);

    const apiHealthRes = await req('/api/health');
    assert.strictEqual(apiHealthRes.status, 200, 'GET /api/health must return 200');
    assert.strictEqual(apiHealthRes.body.status, 'ok', 'API Health status must be "ok"');
    console.log('   ✓ GET /api/health returned 200 OK:', apiHealthRes.body);

    // -------------------------------------------------------------
    // 2. Admin Login via Sanctuary Gate
    // -------------------------------------------------------------
    console.log('\n► 2. Authenticating as Admin (wabisabiofficial3@gmail.com)...');
    const authRes = await req('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { identifier: 'wabisabiofficial3@gmail.com', password: 'DsL@678_' }
    });
    assert.strictEqual(authRes.status, 200, 'Admin login must succeed');
    const setCookie = authRes.headers['set-cookie'];
    assert(setCookie && setCookie.length > 0, 'Must return session cookie');
    const sessionCookieStr = setCookie[0].split(';')[0];
    const [cookieName, sessionCookieVal] = sessionCookieStr.split('=');
    console.log(`   ✓ Admin login authenticated successfully. Cookie obtained: ${cookieName}`);

    // -------------------------------------------------------------
    // 3. Member Lifecycle API Check (Add, Edit, Count, Remove)
    // -------------------------------------------------------------
    console.log('\n► 3. Testing Member Data & Count Synchronization via APIs...');
    const portalInitRes = await req('/api/portal');
    const initialMembers = portalInitRes.body.portal.community.members;
    const initialCount = initialMembers.length;
    console.log(`   Initial active souls in database: ${initialCount}`);

    // Add a temporary test soul
    const testName = 'Zen Pioneer ' + Math.floor(Math.random() * 1000);
    const addRes = await req('/api/curator/members', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: sessionCookieStr
        },
        body: {
            name: testName,
            role: 'Member',
            handle: '@zenpioneer',
            bio: 'Walking softly across stone pathways.'
        }
    });
    assert([200, 201].includes(addRes.status), 'Adding member via curator API must succeed');
    assert(addRes.body.success, 'addRes body must report success');
    const newMemberId = addRes.body.memberId;
    console.log(`   ✓ Added test member "${testName}" with ID ${newMemberId}`);

    // Check count updated in portal API
    const portalAfterAdd = await req('/api/portal');
    const afterAddMembers = portalAfterAdd.body.portal.community.members;
    assert.strictEqual(afterAddMembers.length, initialCount + 1, 'Member count must increment by 1');
    assert(afterAddMembers.some(m => m.id === newMemberId && m.name === testName), 'New member must be present in portal data');
    console.log(`   ✓ Portal API reflects new total count: ${afterAddMembers.length}`);

    // Edit test soul
    const updatedBio = 'Deeply rooted in simplicity and presence.';
    const editRes = await req(`/api/curator/members/${newMemberId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Cookie: sessionCookieStr
        },
        body: {
            name: testName + ' Updated',
            role: 'Curator',
            handle: '@zenpioneer',
            bio: updatedBio
        }
    });
    assert.strictEqual(editRes.status, 200, 'Editing member via curator API must succeed');
    console.log(`   ✓ Updated member role to "Curator" and bio`);

    // Clean up test soul
    const delRes = await req(`/api/curator/members/${newMemberId}`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookieStr }
    });
    assert.strictEqual(delRes.status, 200, 'Deleting member via curator API must succeed');
    const portalAfterDel = await req('/api/portal');
    assert.strictEqual(portalAfterDel.body.portal.community.members.length, initialCount, 'Member count must return to original');
    console.log(`   ✓ Deleted test member. Count restored to ${initialCount}`);

    // -------------------------------------------------------------
    // 4. Headless Browser Verification (Edge CDP)
    // -------------------------------------------------------------
    console.log('\n► 4. Launching Headless Edge for UI Verification...');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9238',
        '--window-size=1440,900',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-reqcheck-' + Date.now(),
        'http://localhost:3000/home.html'
    ]);

    try {
        await new Promise(r => setTimeout(r, 1500));
        const resList = await fetch('http://127.0.0.1:9238/json/list');
        const list = await resList.json();
        const target = list.find(t => t.url && t.url.includes('home.html') && t.webSocketDebuggerUrl);
        if (!target) throw new Error('Browser target home.html not found');

        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);

        let id = 1;
        const callbacks = new Map();
        const browserLogs = [];
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id && callbacks.has(msg.id)) {
                const cb = callbacks.get(msg.id);
                callbacks.delete(msg.id);
                cb(msg.result, msg.error);
            }
            if (msg.method === 'Runtime.consoleAPICalled') {
                const text = msg.params.args.map(a => a.value || a.description).join(' ');
                browserLogs.push(text);
            }
        };

        function send(method, params = {}) {
            return new Promise((resolve, reject) => {
                const reqId = id++;
                callbacks.set(reqId, (result, error) => {
                    if (error) reject(error);
                    else resolve(result);
                });
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        await send('Runtime.enable');
        await send('Page.enable');
        await send('Network.enable');

        // Set the admin session cookie in the browser to simulate reopening while logged in as admin
        await send('Network.setCookie', {
            name: cookieName,
            value: sessionCookieVal,
            domain: 'localhost',
            path: '/'
        });

        // Navigate / Reload home.html with the admin cookie
        await send('Page.navigate', { url: 'http://localhost:3000/home.html' });
        await new Promise(r => setTimeout(r, 1200));

        // A. Verify Public Site Zero Clutter
        console.log('\n► 5. Verifying Public Site (home.html) Reopen with Active Admin Cookie...');
        const clutterCheck = await send('Runtime.evaluate', {
            expression: `(() => ({
                hasCuratorActiveClass: document.body.classList.contains('curator-active'),
                hasFloatingPill: !!document.getElementById('curatorFloatingPill'),
                pencilCount: document.querySelectorAll('.curator-pencil-btn').length,
                hasCuratorOverlay: !!document.getElementById('curatorDrawerOverlay'),
                hasScrollIndicator: !!document.getElementById('wabiScrollIndicator')
            }))()`,
            returnByValue: true
        });

        const clutter = clutterCheck.result.value;
        console.log('   Public Portal DOM Inspection:', clutter);
        assert.strictEqual(clutter.hasCuratorActiveClass, false, 'Body must NOT have curator-active class');
        assert.strictEqual(clutter.hasFloatingPill, false, '#curatorFloatingPill must NOT exist');
        assert.strictEqual(clutter.pencilCount, 0, 'No .curator-pencil-btn elements should exist');
        assert.strictEqual(clutter.hasCuratorOverlay, false, '#curatorDrawerOverlay must NOT exist');
        assert.strictEqual(clutter.hasScrollIndicator, true, '#wabiScrollIndicator MUST exist');
        console.log('   ✓ Public portal is 100% serene and devoid of admin clutter!');

        // B. Dynamic Member Counts on Community Tab
        console.log('\n► 6. Verifying Dynamic Member Counts & Badges on home.html...');
        await send('Runtime.evaluate', {
            expression: `document.getElementById('tokenCommunity').click()`
        });
        await new Promise(r => setTimeout(r, 400));

        const countsCheck = await send('Runtime.evaluate', {
            expression: `(() => ({
                countAll: document.getElementById('countAllMembers')?.textContent.trim(),
                countCurator: document.getElementById('countCuratorMembers')?.textContent.trim(),
                countRegular: document.getElementById('countRegularMembers')?.textContent.trim(),
                totalCards: document.querySelectorAll('#communityDirectoryGrid .member-polaroid-card').length
            }))()`,
            returnByValue: true
        });

        const counts = countsCheck.result.value;
        console.log('   Community tab badges & rendered cards:', counts);
        assert.strictEqual(Number(counts.countAll), initialCount, 'All Souls count badge must equal total members');
        assert.strictEqual(counts.totalCards, initialCount, 'Total rendered cards must match total members');
        console.log('   ✓ Community counts and polaroid cards dynamically match database!');

        // C. Connect Tab Avatar Stack and Member Count Label
        console.log('\n► 7. Verifying Connect Tab Dynamic Avatar Stack & Member Count...');
        await send('Runtime.evaluate', {
            expression: `document.getElementById('tokenConnect').click()`
        });
        await new Promise(r => setTimeout(r, 400));

        const connectCheck = await send('Runtime.evaluate', {
            expression: `(() => ({
                countLabel: document.getElementById('connectAvatarCount')?.textContent.trim(),
                avatarCount: document.querySelectorAll('#connectAvatarStack img').length
            }))()`,
            returnByValue: true
        });

        const connectData = connectCheck.result.value;
        console.log('   Connect tab data:', connectData);
        assert(connectData.countLabel.includes(`${initialCount} member`), `Count label must include "${initialCount} member"`);
        assert.strictEqual(connectData.avatarCount, Math.min(initialCount, 5), 'Avatar stack must show up to 5 real members');
        console.log('   ✓ Connect tab avatar stack and member count dynamically match database!');

        // D. Side Scroll Indicator Visibility & Smooth Scrolling
        console.log('\n► 8. Verifying Aesthetic Side Scroll Indicator...');
        const scrollCheck = await send('Runtime.evaluate', {
            expression: `(() => {
                const indicator = document.getElementById('wabiScrollIndicator');
                const isVisible = indicator.classList.contains('visible');
                const scrollYBefore = window.scrollY;
                return { isVisible, scrollYBefore };
            })()`,
            returnByValue: true
        });
        console.log('   Scroll Indicator on long tab (Connect):', scrollCheck.result.value);
        assert.strictEqual(scrollCheck.result.value.isVisible, true, 'Scroll indicator must be visible on long page');

        // Click indicator
        await send('Runtime.evaluate', {
            expression: `document.getElementById('wabiScrollIndicator').click()`
        });
        await new Promise(r => setTimeout(r, 600));

        const afterScrollCheck = await send('Runtime.evaluate', {
            expression: `window.scrollY`,
            returnByValue: true
        });
        console.log(`   Scroll position after clicking scroll arrow: ${afterScrollCheck.result.value}px`);
        assert(afterScrollCheck.result.value > scrollCheck.result.value.scrollYBefore, 'Clicking scroll indicator must scroll page down');
        console.log('   ✓ Side scroll indicator smooth scrolling operates flawlessly!');

        // E. Curator Portal Inspection & Silent Heartbeat Check
        console.log('\n► 9. Verifying Curator Studio (curator.html) & Invisible Keep-Alive...');
        await send('Page.navigate', { url: 'http://localhost:3000/curator.html' });
        await new Promise(r => setTimeout(r, 1600));

        const curatorCheck = await send('Runtime.evaluate', {
            expression: `(() => ({
                url: window.location.href,
                peopleBadge: document.getElementById('curatorPeopleCountBadge')?.textContent.trim(),
                hasHeartbeatFunction: typeof window._curatorKeepAliveHeartbeat === 'function',
                heartbeatDomElements: document.querySelectorAll('[id*="heartbeat"], [class*="heartbeat"]').length
            }))()`,
            returnByValue: true
        });

        console.log('   Curator Studio check:', curatorCheck.result.value);
        assert(curatorCheck.result.value.url.includes('curator.html'), `Must remain on curator.html, got: ${curatorCheck.result.value.url}`);
        assert(curatorCheck.result.value.peopleBadge && curatorCheck.result.value.peopleBadge.includes(`${initialCount} soul`), 'People badge in curator studio must be accurate');
        assert.strictEqual(curatorCheck.result.value.heartbeatDomElements, 0, 'Health check / keep-alive must have ZERO visual DOM footprint');
        console.log('   ✓ Curator Studio verified: accurate badge count and completely invisible keep-alive!');

        ws.close();
        edgeProcess.kill();

        console.log('\n================================================================');
        console.log('   ALL USER REQUIREMENTS VERIFIED AND 100% OPERATIONAL!');
        console.log('================================================================\n');

    } catch (err) {
        edgeProcess.kill();
        throw err;
    }
}

runVerification().catch(err => {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exit(1);
});

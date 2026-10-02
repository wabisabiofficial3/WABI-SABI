const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:3000';

async function testPaperPlaneToggle() {
    console.log('================================================================');
    console.log('   WABI SABI PAPER AIRPLANE ON/OFF OPTION AUDIT');
    console.log('================================================================\n');

    // 1. Check Public Portal Default State (Must be Default OFF)
    console.log('► 1. Verifying Public Portal Default State via /api/portal...');
    const portalData = await new Promise((resolve, reject) => {
        http.get('http://localhost:3000/api/portal', (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });

    assert(portalData.success, 'Portal endpoint must return success');
    const isDefaultOff = portalData.portal?.features?.paper_plane_enabled === false || portalData.portal?.paper_plane_enabled === false;
    assert.strictEqual(isDefaultOff, true, 'Paper airplane feature must be DEFAULT OFF');
    console.log('   ✓ Paper airplane feature is confirmed DEFAULT OFF in public API!');

    // 2. Authenticate as Admin
    console.log('\n► 2. Authenticating as Admin for Curator Feature Controls...');
    const loginRes = await new Promise((resolve, reject) => {
        const payload = JSON.stringify({ identifier: 'wabisabiofficial3@gmail.com', password: 'DsL@678_' });
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, (res) => {
            const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : null;
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ status: res.statusCode, cookie, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });

    assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
    const cookie = loginRes.cookie;
    assert(cookie, 'Must receive session cookie');
    console.log('   ✓ Admin authenticated successfully.');

    // 3. Test PUT /api/curator/features (Turn ON)
    console.log('\n► 3. Testing Admin Toggle ON (/api/curator/features)...');
    const turnOnRes = await new Promise((resolve, reject) => {
        const payload = JSON.stringify({ paper_plane_enabled: true });
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/curator/features',
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Cookie': cookie
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });

    assert.strictEqual(turnOnRes.status, 200, 'Feature update must succeed');
    assert.strictEqual(turnOnRes.body.success, true);
    assert.strictEqual(turnOnRes.body.settings.paper_plane_enabled, true, 'Settings must reflect paper_plane_enabled = true');
    console.log('   ✓ Successfully turned ON paper plane feature in Admin Account!');

    // Verify Public Portal after turning ON
    const portalOn = await new Promise((resolve, reject) => {
        http.get('http://localhost:3000/api/portal', (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
    assert.strictEqual(portalOn.portal.features.paper_plane_enabled, true, 'Public portal must reflect ON state');
    console.log('   ✓ Public portal immediately reflects ON state!');

    // 4. Test PUT /api/curator/features (Turn back OFF - Default)
    console.log('\n► 4. Testing Admin Toggle back OFF (Default)...');
    const turnOffRes = await new Promise((resolve, reject) => {
        const payload = JSON.stringify({ paper_plane_enabled: false });
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/curator/features',
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Cookie': cookie
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });

    assert.strictEqual(turnOffRes.status, 200);
    assert.strictEqual(turnOffRes.body.settings.paper_plane_enabled, false, 'Settings must reflect paper_plane_enabled = false');
    console.log('   ✓ Successfully restored paper plane feature to DEFAULT OFF!');

    // 5. Headless Browser Verification of UI in Curator Atelier and Public Portal
    console.log('\n► 5. Verifying UI Controls in Headless Edge...');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9288',
        '--window-size=1440,900',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-plane-' + Date.now(),
        'http://localhost:3000/home.html'
    ]);

    try {
        await new Promise(r => setTimeout(r, 2000));
        const resList = await fetch('http://127.0.0.1:9288/json/list');
        const list = await resList.json();
        const target = list.find(t => t.url && t.url.includes('home.html') && t.webSocketDebuggerUrl) || list[0];
        assert(target, 'Edge target not found');

        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);

        let id = 1;
        const callbacks = new Map();
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id && callbacks.has(msg.id)) {
                const cb = callbacks.get(msg.id);
                callbacks.delete(msg.id);
                cb(msg.result, msg.error);
            }
        };

        function send(method, params = {}) {
            return new Promise((resolve, reject) => {
                const reqId = id++;
                callbacks.set(reqId, (result, error) => error ? reject(error) : resolve(result));
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        await send('Runtime.enable');
        await send('Page.enable');

        // Check Public Portal DOM state for rocket button
        const homeCheck = await send('Runtime.evaluate', {
            expression: `(() => {
                const btn = document.getElementById('launchRocketBtn');
                const engine = window.wabiSabiRocket;
                return {
                    btnExists: !!btn,
                    btnDisplay: btn ? window.getComputedStyle(btn).display : 'none',
                    engineEnabled: engine ? engine.enabled : false
                };
            })()`,
            returnByValue: true
        });

        console.log('   Public Portal DOM Check (Default):', homeCheck.result.value);
        assert.strictEqual(homeCheck.result.value.btnDisplay, 'none', 'Button must be hidden by default');
        assert.strictEqual(homeCheck.result.value.engineEnabled, false, 'Rocket engine must be disabled by default');
        console.log('   ✓ Public portal rocket button & engine are strictly disabled by default!');

        // Now set cookie in browser and open Curator Studio
        await send('Network.enable');
        await send('Network.setCookie', {
            name: 'wabisabi_curator_session',
            value: cookie.split(';')[0].split('=')[1],
            domain: 'localhost',
            path: '/'
        });

        await send('Page.navigate', { url: 'http://localhost:3000/curator.html#profile' });
        await new Promise(r => setTimeout(r, 1500));

        const curatorCheck = await send('Runtime.evaluate', {
            expression: `(() => {
                const checkbox = document.getElementById('paperPlaneToggleCheckbox');
                const statusBadge = document.getElementById('paperPlaneStatusBadge');
                const statusText = document.getElementById('paperPlaneToggleText');
                return {
                    checkboxExists: !!checkbox,
                    checked: checkbox ? checkbox.checked : null,
                    badgeText: statusBadge ? statusBadge.textContent.trim() : null,
                    text: statusText ? statusText.textContent.trim() : null
                };
            })()`,
            returnByValue: true
        });

        console.log('   Curator Studio Pillar 5 Feature Controls Check:', curatorCheck.result.value);
        assert.strictEqual(curatorCheck.result.value.checkboxExists, true, 'Toggle checkbox must exist in Curator Studio');
        assert.strictEqual(curatorCheck.result.value.checked, false, 'Toggle must be unchecked (Default OFF)');
        assert(curatorCheck.result.value.badgeText.includes('OFF'), 'Badge must say OFF');
        console.log('   ✓ Curator Studio interactive switch renders properly with Default OFF!');

        ws.close();
        edgeProcess.kill();

        console.log('\n================================================================');
        console.log('   ALL PAPER PLANE ON/OFF REQUIREMENTS PASSED 100% CLEANLY!');
        console.log('================================================================\n');

    } catch (e) {
        edgeProcess.kill();
        throw e;
    }
}

testPaperPlaneToggle().catch(err => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
});

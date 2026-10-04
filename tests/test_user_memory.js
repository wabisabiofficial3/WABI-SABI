const assert = require('node:assert');
const { spawn } = require('child_process');

async function testUserMemory() {
    console.log('================================================================');
    console.log('   WABI SABI USER REMEMBRANCE & RECOGNITION AUDIT');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // 1. API Verification for /api/user/profile
    // -------------------------------------------------------------
    console.log('► 1. Testing /api/user/profile Endpoints...');
    const getRes = await fetch('http://localhost:3000/api/user/profile');
    assert.strictEqual(getRes.status, 200, 'GET /api/user/profile must return 200');
    const getJson = await getRes.json();
    console.log('   Initial Visitor State:', getJson);
    assert.strictEqual(getJson.success, true);
    assert.strictEqual(getJson.isCurator, false);

    // Save profile via POST
    const postRes = await fetch('http://localhost:3000/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Dhanush', genre: 'Existential Philosophy' })
    });
    assert.strictEqual(postRes.status, 200, 'POST /api/user/profile must return 200');
    const postCookie = postRes.headers.get('set-cookie');
    assert(postCookie && postCookie.includes('wabisabi_reader='), 'Must set wabisabi_reader cookie');
    console.log('   ✓ Set persistent cookie:', postCookie.split(';')[0]);

    // Verify GET with cookie
    const getCookieRes = await fetch('http://localhost:3000/api/user/profile', {
        headers: { 'Cookie': postCookie.split(';')[0] }
    });
    const cookieData = await getCookieRes.json();
    assert.strictEqual(cookieData.reader.name, 'Dhanush', 'Reader name must match');
    assert.strictEqual(cookieData.reader.genre, 'Existential Philosophy', 'Reader genre must match');
    console.log('   ✓ Reader profile remembered on server via cookie:', cookieData.reader);

    // -------------------------------------------------------------
    // 2. Full Browser Remembrance Lifecycle (Headless Edge)
    // -------------------------------------------------------------
    console.log('\n► 2. Launching Headless Edge to Verify Client Remembrance...');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9252',
        '--window-size=1440,900',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-memory-' + Date.now(),
        'http://localhost:3000/home.html'
    ]);

    try {
        await new Promise(r => setTimeout(r, 1500));
        const resList = await fetch('http://127.0.0.1:9252/json/list');
        const list = await resList.json();
        const target = list.find(t => t.url && t.url.includes('home.html') && t.webSocketDebuggerUrl);
        assert(target, 'Browser target not found');

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
                callbacks.set(reqId, (result, error) => {
                    if (error) reject(error);
                    else resolve(result);
                });
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        await send('Runtime.enable');
        await send('Page.enable');

        // Wait for page and user memory to be ready
        for (let i = 0; i < 30; i++) {
            const readyRes = await send('Runtime.evaluate', {
                expression: `window._userMemoryReady === true`,
                returnByValue: true
            });
            if (readyRes.result && readyRes.result.value === true) break;
            await new Promise(r => setTimeout(r, 200));
        }

        // A. Initial Visitor state
        console.log('► 3. Verifying Initial Visitor State...');
        const initialChip = await send('Runtime.evaluate', {
            expression: `document.getElementById('readerChipName')?.textContent.trim()`,
            returnByValue: true
        });
        console.log('   Initial Chip Name:', initialChip.result.value);
        assert.strictEqual(initialChip.result.value, 'Reader', 'Initial reader chip must show Reader');

        // B. Personalize Reader Identity
        console.log('► 4. Personalizing Reader Name ("Dhanush")...');
        await send('Runtime.evaluate', {
            expression: `(() => {
                const chip = document.getElementById('readerMemoryChip');
                if (chip) chip.click();
                const nameInp = document.getElementById('readerNameInput');
                if (nameInp) nameInp.value = 'Dhanush';
                const genreInp = document.getElementById('readerGenreInput');
                if (genreInp) genreInp.value = 'Philosophy & Literary Fiction';
                const saveBtn = document.getElementById('saveReaderMemoryBtn');
                if (saveBtn) saveBtn.click();
            })()`
        });

        // Poll until chip and hero greeting update
        let updatedIdentity;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 200));
            const res = await send('Runtime.evaluate', {
                expression: `(() => ({
                    chip: document.getElementById('readerChipName')?.textContent.trim(),
                    hero: document.getElementById('heroPersonalGreeting')?.textContent.trim(),
                    heroVisible: document.getElementById('heroPersonalGreeting')?.style.display !== 'none',
                    stored: JSON.parse(localStorage.getItem('wabi_reader_profile') || '{}')
                }))()`,
                returnByValue: true
            });
            updatedIdentity = res.result.value;
            if (updatedIdentity && updatedIdentity.chip === '✦ Dhanush') break;
            
            // Re-trigger save if not registered yet
            if (i === 10 && (!updatedIdentity.stored || updatedIdentity.stored.name !== 'Dhanush')) {
                await send('Runtime.evaluate', {
                    expression: `(() => {
                        const nameInp = document.getElementById('readerNameInput');
                        if (nameInp) nameInp.value = 'Dhanush';
                        const saveBtn = document.getElementById('saveReaderMemoryBtn');
                        if (saveBtn) saveBtn.click();
                    })()`
                });
            }
        }

        console.log('   Updated Identity in DOM:', updatedIdentity);
        assert.strictEqual(updatedIdentity.chip, '✦ Dhanush', 'Chip must reflect saved name');
        assert(updatedIdentity.hero.includes('Dhanush'), 'Hero greeting must include name');
        assert.strictEqual(updatedIdentity.stored.name, 'Dhanush', 'LocalStorage must contain profile');
        console.log('   ✓ Reader profile successfully personalized and displayed!');

        // C. Navigate and switch filters to test state remembrance
        console.log('\n► 5. Navigating to Community & Selecting Curator Filter...');
        await send('Runtime.evaluate', {
            expression: `(() => {
                document.getElementById('tokenCommunity').click();
                const curPill = document.querySelector('.community-filter-pill[data-filter="curator"]');
                if (curPill) curPill.click();
            })()`
        });
        await new Promise(r => setTimeout(r, 600));

        const stateBeforeReload = await send('Runtime.evaluate', {
            expression: `(() => ({
                lastTab: localStorage.getItem('wabi_last_active_tab'),
                lastFilter: localStorage.getItem('wabi_community_filter')
            }))()`,
            returnByValue: true
        });
        console.log('   Stored State in LocalStorage:', stateBeforeReload.result.value);
        assert.strictEqual(stateBeforeReload.result.value.lastTab, 'community', 'Last tab must be saved as community');
        assert.strictEqual(stateBeforeReload.result.value.lastFilter, 'curator', 'Last filter must be saved as curator');

        // D. Reload page to test full remembrance
        console.log('\n► 6. Reloading Page to Verify Full State Restoration...');
        // Clear hash from URL so handleInitialRoute relies purely on user memory
        await send('Runtime.evaluate', { expression: `history.replaceState(null, '', '/home.html')` });
        await send('Page.reload');

        // Wait for page and user memory to be ready after reload
        for (let i = 0; i < 30; i++) {
            const readyRes = await send('Runtime.evaluate', {
                expression: `window._userMemoryReady === true`,
                returnByValue: true
            });
            if (readyRes.result && readyRes.result.value === true) break;
            await new Promise(r => setTimeout(r, 200));
        }

        const restoredState = await send('Runtime.evaluate', {
            expression: `(() => ({
                chip: document.getElementById('readerChipName')?.textContent.trim(),
                activeTabBtn: document.querySelector('.nav-token-btn.active')?.id,
                activePanel: document.querySelector('.hub-tab-panel.active')?.id,
                activeFilter: document.querySelector('.community-filter-pill.active')?.getAttribute('data-filter')
            }))()`,
            returnByValue: true
        });

        console.log('   Restored State after Page Reload:', restoredState.result.value);
        assert.strictEqual(restoredState.result.value.chip, '✦ Dhanush', 'Must remember reader identity across reload');
        assert.strictEqual(restoredState.result.value.activeTabBtn, 'tokenCommunity', 'Must remember last active tab');
        assert.strictEqual(restoredState.result.value.activePanel, 'panelCommunity', 'Must restore last active panel');
        assert.strictEqual(restoredState.result.value.activeFilter, 'curator', 'Must restore last community filter');
        console.log('   ✓ Full User Remembrance verified across page reloads!');

        ws.close();
        edgeProcess.kill();

        console.log('\n================================================================');
        console.log('   ALL USER REMEMBRANCE REQUIREMENTS PASSED WITH 100% SUCCESS!');
        console.log('================================================================\n');

    } catch (err) {
        edgeProcess.kill();
        throw err;
    }
}

testUserMemory().catch(err => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
});

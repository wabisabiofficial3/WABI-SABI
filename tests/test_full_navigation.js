const { spawn } = require('child_process');

async function testFullNavigation() {
    console.log('Testing full interactive navigation in headless Edge...');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9235',
        '--window-size=1440,900',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-fullnav-' + Date.now(),
        'http://localhost:3000/pages/home.html'
    ]);

    await new Promise(r => setTimeout(r, 1500));
    const res = await fetch('http://127.0.0.1:9235/json/list');
    const list = await res.json();
    const target = list.find(t => t.url && t.url.includes('home.html') && t.webSocketDebuggerUrl);

    if (!target) {
        console.error('Target not found');
        edgeProcess.kill();
        process.exit(1);
    }

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
        if (msg.method === 'Runtime.consoleAPICalled') {
            console.log('[BROWSER]', msg.params.type, msg.params.args.map(a => a.value || a.description));
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
    await send('DOM.enable');

    await new Promise(r => setTimeout(r, 1000));

    async function clickEl(selector) {
        const pos = await send('Runtime.evaluate', {
            expression: `(() => {
                const el = document.querySelector('${selector}');
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2, display: window.getComputedStyle(el).display };
            })()`,
            returnByValue: true
        });
        if (!pos.result.value) throw new Error(`Element not found: ${selector}`);
        const { x, y } = pos.result.value;
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        await new Promise(r => setTimeout(r, 350));
    }

    async function getState() {
        const res = await send('Runtime.evaluate', {
            expression: `(() => ({
                activeBtn: document.querySelector('.nav-token-btn.active')?.id,
                activePanel: document.querySelector('.hub-tab-panel.active')?.id,
                hash: window.location.hash
            }))()`,
            returnByValue: true
        });
        return res.result.value;
    }

    // Step 1: Initial state
    let state = await getState();
    console.log('1. Initial State:', state);
    if (state.activeBtn !== 'tokenDashboard' || state.activePanel !== 'panelDashboard') {
        throw new Error('Initial state failed');
    }

    // Step 2: Click Announcements
    console.log('2. Clicking #tokenAnnouncements with real mouse...');
    await clickEl('#tokenAnnouncements');
    state = await getState();
    console.log('   Result:', state);
    if (state.activeBtn !== 'tokenAnnouncements' || state.activePanel !== 'panelAnnouncements') {
        throw new Error('Announcements click failed');
    }

    // Step 3: Click Community
    console.log('3. Clicking #tokenCommunity with real mouse...');
    await clickEl('#tokenCommunity');
    state = await getState();
    console.log('   Result:', state);
    if (state.activeBtn !== 'tokenCommunity' || state.activePanel !== 'panelCommunity') {
        throw new Error('Community click failed');
    }

    // Step 4: Click Connect
    console.log('4. Clicking #tokenConnect with real mouse...');
    await clickEl('#tokenConnect');
    state = await getState();
    console.log('   Result:', state);
    if (state.activeBtn !== 'tokenConnect' || state.activePanel !== 'panelConnect') {
        throw new Error('Connect click failed');
    }

    // Step 5: Click Dashboard
    console.log('5. Clicking #tokenDashboard with real mouse...');
    await clickEl('#tokenDashboard');
    state = await getState();
    console.log('   Result:', state);
    if (state.activeBtn !== 'tokenDashboard' || state.activePanel !== 'panelDashboard') {
        throw new Error('Dashboard click failed');
    }

    // Step 6: Click Sticky Note 01 (books) on Dashboard
    console.log('6. Clicking Sticky Note 01 (Books) on Dashboard...');
    await clickEl('.sticky-books');
    state = await getState();
    console.log('   Result after clicking Sticky Note 01:', state);
    if (state.activeBtn !== 'tokenAnnouncements' || state.activePanel !== 'panelAnnouncements') {
        throw new Error('Sticky note 01 click navigation failed');
    }

    // Step 7: Back to Dashboard, click Sticky Note 04 (community)
    console.log('7. Returning to Dashboard and clicking Sticky Note 04 (Community)...');
    await clickEl('#tokenDashboard');
    await clickEl('.sticky-community');
    state = await getState();
    console.log('   Result after clicking Sticky Note 04:', state);
    if (state.activeBtn !== 'tokenCommunity' || state.activePanel !== 'panelCommunity') {
        throw new Error('Sticky note 04 click navigation failed');
    }

    // Step 8: Test Filter Pills on Community view
    console.log('8. Testing Filter Pills on Community view...');
    await clickEl('.community-filter-pill[data-filter="curator"]');
    const filterState = await send('Runtime.evaluate', {
        expression: `(() => {
            const cards = Array.from(document.querySelectorAll('#communityDirectoryGrid .member-polaroid-card'));
            const visible = cards.filter(c => c.style.display !== 'none');
            return {
                totalVisible: visible.length,
                visibleRoles: visible.map(c => c.getAttribute('data-role'))
            };
        })()`,
        returnByValue: true
    });
    console.log('   Curators filter result:', filterState.result.value);

    ws.close();
    edgeProcess.kill();
    console.log('\n✓ ALL INTERACTIVE NAVIGATION AND TAB SWITCHING TESTS PASSED PERFECTLY!\n');
}

testFullNavigation().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});

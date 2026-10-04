const { ADMIN_PASSWORD } = require('./test_config');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createMemberSession, getMemberById, regenerateMemberCode } = require('../server/db');

const ARTIFACT_DIR = 'C:\\Users\\dhanu\\.gemini\\antigravity\\brain\\7a63a30c-3ac9-4783-9524-aa29aea1bc85';
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function captureVisuals() {
    console.log('► Starting visual screenshot capture of Member-Access System...');

    // 1. Get Akshaya and issue a fresh random code/session for this optional capture.
    const akshaya = getMemberById('mem-akshaya');
    if (!akshaya) throw new Error('Akshaya not found in db');
    regenerateMemberCode(akshaya.id);
    const session = createMemberSession(akshaya.id, 7);

    // 2. Launch headless edge
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9244',
        '--window-size=1440,960',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-visuals-' + Date.now(),
        `${BASE_URL}/home.html`
    ]);

    try {
        await new Promise(r => setTimeout(r, 2000));
        const resList = await fetch('http://127.0.0.1:9244/json/list');
        const list = await resList.json();
        const target = list.find(t => t.url && t.url.includes('home.html') && t.webSocketDebuggerUrl);
        if (!target) throw new Error('Target home.html not found in browser');

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
        await send('Network.enable');

        // Capture 1: Home page with Member Access Modal Open
        console.log('► 1. Capturing Member Access Modal on home.html...');
        await send('Runtime.evaluate', {
            expression: `
                const btn = document.getElementById('openMemberSpaceBtn');
                if (btn) btn.click();
            `
        });
        await new Promise(r => setTimeout(r, 800));

        const shot1 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'member_access_modal_view.png'), Buffer.from(shot1.data, 'base64'));
        console.log('   ✓ Saved member_access_modal_view.png');

        // Capture 2: Member Space (/my-space)
        console.log('► 2. Capturing Member Desk (/my-space)...');
        await send('Network.setCookie', {
            name: 'wabisabi_member_session',
            value: session.token,
            domain: 'localhost',
            path: '/',
            httpOnly: true
        });

        await send('Page.navigate', { url: `${BASE_URL}/my-space` });
        await new Promise(r => setTimeout(r, 1800));

        const shot2 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'member_space_desk_view.png'), Buffer.from(shot2.data, 'base64'));
        console.log('   ✓ Saved member_space_desk_view.png');

        // Capture 3: Curator Studio Member Directory & Physical QR Card Modal
        console.log('► 3. Logging into Sanctuary and capturing Member Directory & Card Modal...');
        await send('Page.navigate', { url: `${BASE_URL}/sanctuary` });
        await new Promise(r => setTimeout(r, 1500));

        // Submit sanctuary login form
        await send('Runtime.evaluate', {
            expression: `
                const emailInput = document.getElementById('sanctuaryEmail') || document.querySelector('input[type="email"]') || document.querySelector('input[placeholder*="curator"]');
                const passInput = document.getElementById('sanctuaryPassword') || document.querySelector('input[type="password"]');
                const form = document.getElementById('sanctuaryLoginForm') || document.querySelector('form');
                if (emailInput) emailInput.value = 'wabisabiofficial3@gmail.com';
                if (passInput) passInput.value = ADMIN_PASSWORD;
                if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            `
        });
        await new Promise(r => setTimeout(r, 2000));

        // Switch to Member Directory tab
        await send('Runtime.evaluate', {
            expression: `
                const memTab = document.getElementById('curTabCommunity');
                if (memTab) memTab.click();
            `
        });
        await new Promise(r => setTimeout(r, 1200));

        // Open QR card modal for Akshaya
        await send('Runtime.evaluate', {
            expression: `
                const qrBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('QR Card'));
                if (qrBtns.length > 0) qrBtns[0].click();
            `
        });
        await new Promise(r => setTimeout(r, 1200));

        const shot3 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'curator_member_directory_card_view.png'), Buffer.from(shot3.data, 'base64'));
        console.log('   ✓ Saved curator_member_directory_card_view.png');

        ws.close();
        edgeProcess.kill();
        console.log('\n✓ Visual verification captures completed successfully!\n');
    } catch (err) {
        edgeProcess.kill();
        console.error('Screenshot capture failed:', err);
    }
}

captureVisuals();

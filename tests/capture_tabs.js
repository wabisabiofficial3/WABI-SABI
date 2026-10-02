const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = 'C:\\Users\\dhanu\\.gemini\\antigravity\\brain\\7a63a30c-3ac9-4783-9524-aa29aea1bc85';
const BASE_URL = 'http://localhost:3000';

async function captureTabs() {
    const port = 9266;
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,960',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-tabcheck-' + Date.now(),
        BASE_URL + '/home.html'
    ]);

    try {
        await new Promise(r => setTimeout(r, 2000));
        const resList = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await resList.json();
        const target = list.find(t => t.url && t.url.includes('home.html') && t.webSocketDebuggerUrl) || list.find(t => t.webSocketDebuggerUrl && !t.url.startsWith('edge://'));
        if (!target) throw new Error('Target not found');

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

        // Dismiss cookie banner
        await send('Runtime.evaluate', {
            expression: `
                const banner = document.getElementById('wabiCookieBanner');
                if (banner) banner.style.display = 'none';
            `
        });

        // 1. Announcements
        console.log('Capturing Announcements tab...');
        await send('Runtime.evaluate', {
            expression: `switchTab('announcements', true);`
        });
        await new Promise(r => setTimeout(r, 1200));
        const shotAnn = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'tab_announcements_current.png'), Buffer.from(shotAnn.data, 'base64'));

        // 2. Community
        console.log('Capturing Community tab...');
        await send('Runtime.evaluate', {
            expression: `switchTab('community', true);`
        });
        await new Promise(r => setTimeout(r, 1200));
        const shotComm = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'tab_community_current.png'), Buffer.from(shotComm.data, 'base64'));

        // 3. Connect
        console.log('Capturing Connect tab...');
        await send('Runtime.evaluate', {
            expression: `switchTab('connect', true);`
        });
        await new Promise(r => setTimeout(r, 1200));
        const shotConn = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'tab_connect_current.png'), Buffer.from(shotConn.data, 'base64'));

        // 4. Dashboard
        console.log('Capturing Dashboard tab...');
        await send('Runtime.evaluate', {
            expression: `switchTab('dashboard', true);`
        });
        await new Promise(r => setTimeout(r, 1200));
        const shotDash = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'tab_dashboard_current.png'), Buffer.from(shotDash.data, 'base64'));

        ws.close();
        edgeProcess.kill();
        console.log('✓ All tab screenshots captured successfully!');
    } catch (e) {
        edgeProcess.kill();
        console.error('Failed to capture:', e);
    }
}

captureTabs();

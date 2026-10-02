const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\dhanu\\.gemini\\antigravity\\brain\\7a63a30c-3ac9-4783-9524-aa29aea1bc85';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function capture() {
    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9258',
        '--window-size=1440,900',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-capmem-' + Date.now(),
        'http://localhost:3000/home.html'
    ]);

    try {
        await new Promise(r => setTimeout(r, 1500));
        const resList = await fetch('http://127.0.0.1:9258/json/list');
        const list = await resList.json();
        const target = list.find(t => t.url && t.url.includes('home.html') && t.webSocketDebuggerUrl);

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

        // Wait for page ready
        for (let i = 0; i < 30; i++) {
            const readyRes = await send('Runtime.evaluate', {
                expression: `window._userMemoryReady === true`,
                returnByValue: true
            });
            if (readyRes.result && readyRes.result.value === true) break;
            await new Promise(r => setTimeout(r, 200));
        }

        // Set personalized reader profile and open modal
        await send('Runtime.evaluate', {
            expression: `(() => {
                const profile = { name: 'Dhanush', genre: 'Philosophy & Literary Fiction', savedAt: new Date().toISOString() };
                localStorage.setItem('wabi_reader_profile', JSON.stringify(profile));
                localStorage.setItem('wabi_cookie_consent', 'essential');
                const chip = document.getElementById('readerChipName');
                if (chip) chip.textContent = '✦ Dhanush';
                const hero = document.getElementById('heroPersonalGreeting');
                if (hero) {
                    hero.textContent = '✦ Welcome back to the sanctuary, Dhanush.';
                    hero.style.display = 'inline-block';
                }
                const modal = document.getElementById('readerMemoryModal');
                if (modal) {
                    modal.style.display = 'flex';
                    modal.classList.add('active');
                }
                const nInput = document.getElementById('readerNameInput');
                if (nInput) nInput.value = 'Dhanush';
                const gInput = document.getElementById('readerGenreInput');
                if (gInput) gInput.value = 'Philosophy & Literary Fiction';
            })()`
        });

        await new Promise(r => setTimeout(r, 600));

        // Capture screenshot
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        const filePath = path.join(ARTIFACT_DIR, 'user_memory_modal_view.png');
        fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
        console.log(`✓ Captured user memory modal view to: ${filePath}`);

        // Now close modal and capture hero greeting + chip
        await send('Runtime.evaluate', {
            expression: `(() => {
                const modal = document.getElementById('readerMemoryModal');
                if (modal) {
                    modal.classList.remove('active');
                    modal.style.display = 'none';
                }
            })()`
        });
        await new Promise(r => setTimeout(r, 400));

        const screenshotHero = await send('Page.captureScreenshot', { format: 'png' });
        const heroFilePath = path.join(ARTIFACT_DIR, 'user_memory_hero_greeting.png');
        fs.writeFileSync(heroFilePath, Buffer.from(screenshotHero.data, 'base64'));
        console.log(`✓ Captured user memory hero greeting to: ${heroFilePath}`);

        ws.close();
        edgeProcess.kill();
    } catch (e) {
        edgeProcess.kill();
        throw e;
    }
}

capture().catch(err => {
    console.error(err);
    process.exit(1);
});

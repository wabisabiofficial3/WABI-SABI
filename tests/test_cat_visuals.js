const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = 'C:\\Users\\dhanu\\.gemini\\antigravity\\brain\\7a63a30c-3ac9-4783-9524-aa29aea1bc85';
const BASE_URL = 'http://localhost:3000';

async function testCatVisuals() {
    const port = 9277;
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,960',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-catcheck-' + Date.now(),
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
                switchTab('community', true);
            `
        });

        // Check positions
        const catInfo = await send('Runtime.evaluate', {
            expression: `
                (() => {
                    const cat = document.getElementById('livingCatActor');
                    const taskbar = document.getElementById('bottomTaskbar');
                    const sprite = document.getElementById('catSprite');
                    const rectCat = cat ? cat.getBoundingClientRect() : null;
                    const rectBar = taskbar ? taskbar.getBoundingClientRect() : null;
                    return {
                        windowHeight: window.innerHeight,
                        taskbar: rectBar ? { top: rectBar.top, bottom: rectBar.bottom, height: rectBar.height } : null,
                        cat: rectCat ? { top: rectCat.top, bottom: rectCat.bottom, height: rectCat.height, left: rectCat.left } : null,
                        spriteSrc: sprite ? sprite.src : null
                    };
                })()
            `,
            returnByValue: true
        });

        console.log('Cat & Taskbar metrics:', JSON.stringify(catInfo.result.value, null, 2));

        // Let the cat walk for 1.5 seconds
        await new Promise(r => setTimeout(r, 1500));
        const shot1 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'cat_walking_frame_1.png'), Buffer.from(shot1.data, 'base64'));

        // Let the cat walk for another 0.5s
        await new Promise(r => setTimeout(r, 500));
        const shot2 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'cat_walking_frame_2.png'), Buffer.from(shot2.data, 'base64'));

        ws.close();
        edgeProcess.kill();
        console.log('Visual test complete!');
    } catch (e) {
        edgeProcess.kill();
        console.error('Test error:', e);
    }
}

testCatVisuals();

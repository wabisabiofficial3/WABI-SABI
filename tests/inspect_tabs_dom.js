const { spawn } = require('child_process');

async function testDom() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9262',
        '--window-size=1440,960',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-inspect-' + Date.now(),
        'http://localhost:3000/home.html#announcements'
    ]);

    await new Promise(r => setTimeout(r, 2000));
    const list = await (await fetch('http://127.0.0.1:9262/json/list')).json();
    const ws = new WebSocket(list[0].webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const reqId = id++;
            ws.onmessage = (e) => {
                const m = JSON.parse(e.data);
                if (m.id === reqId) m.error ? reject(m.error) : resolve(m.result);
            };
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });
    }

    await send('Runtime.enable');
    await send('Page.enable');

    const res = await send('Runtime.evaluate', {
        expression: `
            (() => {
                const ann = document.getElementById('panelAnnouncements');
                const comm = document.getElementById('panelCommunity');
                const conn = document.getElementById('panelConnect');
                const dash = document.getElementById('panelDashboard');
                return JSON.stringify({
                    url: window.location.href,
                    title: document.title,
                    bodyLen: document.body.innerHTML.length,
                    ids: Array.from(document.querySelectorAll('[id]')).map(el => el.id)
                });
            })()
        `,
        returnByValue: true
    });

    console.log('DOM info response:', res);
    ws.close();
    edge.kill();
}
testDom().catch(console.error);

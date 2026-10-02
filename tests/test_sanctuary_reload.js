const { spawn } = require('child_process');
const os = require('os');

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = os.tmpdir() + '\\edge-sanctuary-test-' + Date.now();

  const p = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9256',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + tmpDir,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9256/json/list');
    const list = await listRes.json();
    const target = list[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((res, rej) => {
        const i = id++;
        const handler = (ev) => {
          const d = JSON.parse(ev.data);
          if (d.id === i) {
            ws.removeEventListener('message', handler);
            if (d.error) rej(d.error); else res(d.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');

    const navigations = [];
    ws.addEventListener('message', (ev) => {
      try {
        const text = typeof ev.data === 'string' ? ev.data : ev.data.toString();
        const d = JSON.parse(text);
        if (d.method === 'Page.frameNavigated') {
          navigations.push(d.params.frame.url);
          console.log('Navigated to:', d.params.frame.url);
        }
        if (d.method === 'Runtime.consoleAPICalled') {
          console.log('Console:', d.params.type, d.params.args.map(a => a.value || a.description).join(' '));
        }
        if (d.method === 'Runtime.exceptionThrown') {
          console.log('Exception:', JSON.stringify(d.params.exceptionDetails));
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    });

    console.log('Step 1: Navigate to /sanctuary');
    await send('Page.navigate', { url: 'http://localhost:3000/sanctuary' });
    await new Promise(r => setTimeout(r, 1000));

    console.log('Step 2: Simulate leftover localStorage wabisabi_cached_user (no cookie)');
    await send('Runtime.evaluate', {
      expression: "localStorage.setItem('wabisabi_cached_user', JSON.stringify({ id: 'admin-wabisabi', role: 'ADMIN' }));"
    });

    console.log('Step 3: Reload /sanctuary and observe navigations for 5 seconds');
    await send('Page.navigate', { url: 'http://localhost:3000/sanctuary' });
    await new Promise(r => setTimeout(r, 5000));

    console.log('Total navigations recorded:', navigations.length);
    console.log('Navigations list:', navigations);

    p.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    p.kill();
    process.exit(1);
  }
}

run();

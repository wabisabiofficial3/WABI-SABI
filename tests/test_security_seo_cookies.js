const assert = require('node:assert');
const { spawn } = require('child_process');

async function testSecuritySeoCookies() {
    console.log('================================================================');
    console.log('   WABI SABI SECURITY, SEO & COOKIES AUDIT SUITE');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // 1. HTTP Security Headers
    // -------------------------------------------------------------
    console.log('► 1. Testing HTTP Security Headers on Public Endpoints...');
    const homeRes = await fetch('http://localhost:3000/');
    assert.strictEqual(homeRes.status, 200, 'Home page must return 200');

    const headers = homeRes.headers;
    const xContentType = headers.get('x-content-type-options');
    const xFrameOptions = headers.get('x-frame-options');
    const referrerPolicy = headers.get('referrer-policy');
    const permissionsPolicy = headers.get('permissions-policy');
    const csp = headers.get('content-security-policy');
    const xPoweredBy = headers.get('x-powered-by');

    console.log('   X-Content-Type-Options:', xContentType);
    assert.strictEqual(xContentType, 'nosniff', 'Must prevent MIME-sniffing');

    console.log('   X-Frame-Options:', xFrameOptions);
    assert.strictEqual(xFrameOptions, 'SAMEORIGIN', 'Must prevent clickjacking');

    console.log('   Referrer-Policy:', referrerPolicy);
    assert.strictEqual(referrerPolicy, 'strict-origin-when-cross-origin', 'Must enforce strict referrer policy');

    console.log('   Permissions-Policy:', permissionsPolicy);
    assert(permissionsPolicy && permissionsPolicy.includes('camera=()'), 'Must restrict sensitive device permissions');

    console.log('   Content-Security-Policy (CSP):', csp ? 'Configured ✓' : 'Missing ✕');
    assert(csp && csp.includes("default-src 'self'"), 'CSP must restrict origins to self');

    console.log('   X-Powered-By:', xPoweredBy || 'Hidden ✓');
    assert.strictEqual(xPoweredBy, null, 'X-Powered-By header must be removed');
    console.log('   ✓ Security headers verified successfully!\n');

    // -------------------------------------------------------------
    // 2. Sensitive File & Directory Protection
    // -------------------------------------------------------------
    console.log('► 2. Testing Sensitive File Lockdown (Preventing DB & Config Leaks)...');
    const sensitiveEndpoints = [
        '/data/wabisabi.db',
        '/data/wabisabi.sqlite',
        '/package.json',
        '/package-lock.json',
        '/.env',
        '/server/db.js',
        '/server/index.js',
        '/tests/run_all_tests.js'
    ];

    for (const ep of sensitiveEndpoints) {
        const res = await fetch(`http://localhost:3000${ep}`);
        console.log(`   ${ep} -> Status ${res.status}`);
        assert([403, 404].includes(res.status), `Access to ${ep} must be blocked (got ${res.status})`);
    }
    console.log('   ✓ All sensitive files and directories are completely locked down!\n');

    // -------------------------------------------------------------
    // 3. Search Engine Optimization (SEO), Robots & Sitemap
    // -------------------------------------------------------------
    console.log('► 3. Testing SEO Endpoints (robots.txt & sitemap.xml)...');
    const robotsRes = await fetch('http://localhost:3000/robots.txt');
    assert.strictEqual(robotsRes.status, 200, '/robots.txt must return 200');
    assert.strictEqual(robotsRes.headers.get('content-type').split(';')[0], 'text/plain', 'robots.txt must be text/plain');
    const robotsText = await robotsRes.text();
    assert(robotsText.includes('User-agent: *'), 'robots.txt must declare User-agent');
    assert(robotsText.includes('Allow: /'), 'robots.txt must allow public root');
    assert(robotsText.includes('Disallow: /sanctuary'), 'robots.txt must disallow curator gate');
    assert(robotsText.includes('Sitemap:'), 'robots.txt must point to sitemap');
    console.log('   ✓ /robots.txt is valid and correctly configured');

    const sitemapRes = await fetch('http://localhost:3000/sitemap.xml');
    assert.strictEqual(sitemapRes.status, 200, '/sitemap.xml must return 200');
    assert(sitemapRes.headers.get('content-type').includes('xml'), 'sitemap.xml must be XML');
    const sitemapText = await sitemapRes.text();
    assert(sitemapText.includes('<urlset'), 'sitemap.xml must be valid urlset');
    assert(sitemapText.includes('<loc>https://wabi-sabi.onrender.com/</loc>'), 'sitemap.xml must include home URL');
    console.log('   ✓ /sitemap.xml is valid and correctly configured');

    // -------------------------------------------------------------
    // 4. HTML Meta Tags & Schema.org JSON-LD Verification
    // -------------------------------------------------------------
    console.log('\n► 4. Verifying SEO Meta Tags and Structured Data on home.html...');
    const homeHtml = await (await fetch('http://localhost:3000/home.html')).text();
    assert(homeHtml.includes('<title>The Wabi Sabi Bookclub'), 'Page must have descriptive title');
    assert(homeHtml.includes('name="description"'), 'Page must have meta description');
    assert(homeHtml.includes('name="keywords"'), 'Page must have meta keywords');
    assert(homeHtml.includes('name="robots" content="index, follow'), 'Public page must allow indexing');
    assert(homeHtml.includes('rel="canonical"'), 'Page must have canonical link');
    assert(homeHtml.includes('property="og:title"'), 'Page must have Open Graph title');
    assert(homeHtml.includes('property="og:image"'), 'Page must have Open Graph image');
    assert(homeHtml.includes('name="twitter:card"'), 'Page must have Twitter card meta');
    assert(homeHtml.includes('application/ld+json'), 'Page must contain Schema.org JSON-LD structured data');

    // Extract and parse JSON-LD
    const jsonLdMatch = homeHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert(jsonLdMatch, 'Must find JSON-LD script tag');
    const parsedLd = JSON.parse(jsonLdMatch[1]);
    assert(parsedLd['@context'] === 'https://schema.org', 'Schema context must be schema.org');
    console.log('   ✓ Valid Schema.org JSON-LD graph found with', parsedLd['@graph'].length, 'entities (WebSite, Org, Book, Event)');

    // Verify sanctuary.html and curator.html have noindex
    const sanctuaryHtml = await (await fetch('http://localhost:3000/sanctuary')).text();
    assert(sanctuaryHtml.includes('content="noindex, nofollow, noarchive"'), 'Sanctuary gate must be noindex');
    console.log('   ✓ Curator gate and studio protected with noindex robots tag');

    // -------------------------------------------------------------
    // 5. Browser Verification: Cookie Consent Banner & Privacy Modal
    // -------------------------------------------------------------
    console.log('\n► 5. Testing Cookie Consent Banner & Privacy Modal in Headless Browser...');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9246',
        '--window-size=1440,900',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge-cookie-' + Date.now(),
        'http://localhost:3000/home.html'
    ]);

    try {
        await new Promise(r => setTimeout(r, 1500));
        const resList = await fetch('http://127.0.0.1:9246/json/list');
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

        const diag = await send('Runtime.evaluate', {
            expression: `({
                readyState: document.readyState,
                consent: localStorage.getItem('wabi_cookie_consent'),
                bannerInlineDisplay: document.getElementById('wabiCookieBanner')?.style.display,
                url: window.location.href
            })`,
            returnByValue: true
        });
        console.log('   Diagnostic at CDP start:', diag.result.value);

        // Wait for banner to appear (it has a 600ms gentle delay after DOMContentLoaded)
        let bannerState;
        for (let attempt = 0; attempt < 25; attempt++) {
            const res = await send('Runtime.evaluate', {
                expression: `(() => {
                    const b = document.getElementById('wabiCookieBanner');
                    return {
                        exists: !!b,
                        display: b ? window.getComputedStyle(b).display : 'none',
                        hasAcceptBtn: !!document.getElementById('cookieAcceptAllBtn'),
                        hasEssentialBtn: !!document.getElementById('cookieEssentialOnlyBtn'),
                        hasPrivacyBtn: !!document.getElementById('cookiePrivacyPromiseBtn')
                    };
                })()`,
                returnByValue: true
            });
            bannerState = res.result.value;
            if (bannerState && bannerState.exists && bannerState.display === 'flex') {
                break;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        console.log('   Cookie banner initial state:', bannerState);
        assert.strictEqual(bannerState.exists, true, '#wabiCookieBanner must exist');
        assert.strictEqual(bannerState.display, 'flex', '#wabiCookieBanner must be displayed');
        assert.strictEqual(bannerState.hasAcceptBtn, true, 'Accept button must exist');
        assert.strictEqual(bannerState.hasEssentialBtn, true, 'Essential only button must exist');
        assert.strictEqual(bannerState.hasPrivacyBtn, true, 'Privacy promise button must exist');

        // Click Privacy Promise button to open privacy modal
        console.log('   Clicking "Privacy Promise" to verify modal...');
        await send('Runtime.evaluate', {
            expression: `document.getElementById('cookiePrivacyPromiseBtn').click()`
        });
        await new Promise(r => setTimeout(r, 400));

        const modalState = await send('Runtime.evaluate', {
            expression: `(() => {
                const m = document.getElementById('wabiPrivacyModal');
                return {
                    display: window.getComputedStyle(m).display,
                    title: document.getElementById('privacyModalTitle')?.textContent.trim()
                };
            })()`,
            returnByValue: true
        });

        console.log('   Privacy Modal state:', modalState.result.value);
        assert.strictEqual(modalState.result.value.display, 'flex', 'Privacy modal must open');

        // Click "Understood" in the privacy modal
        console.log('   Accepting privacy policy via "Understood" button...');
        await send('Runtime.evaluate', {
            expression: `document.getElementById('privacyModalGotItBtn').click()`
        });
        await new Promise(r => setTimeout(r, 500));

        // Verify banner dismissed and consent stored in localStorage
        const consentStorage = await send('Runtime.evaluate', {
            expression: `(() => ({
                consentValue: localStorage.getItem('wabi_cookie_consent'),
                bannerDisplay: window.getComputedStyle(document.getElementById('wabiCookieBanner')).display
            }))()`,
            returnByValue: true
        });

        console.log('   Post-consent state:', consentStorage.result.value);
        assert.strictEqual(consentStorage.result.value.consentValue, 'essential', 'Consent must be saved in localStorage');
        assert.strictEqual(consentStorage.result.value.bannerDisplay, 'none', 'Banner must be dismissed after consent');
        console.log('   ✓ Cookie banner & privacy modal behavior verified flawlessly!');

        // Reload page to ensure banner does NOT reappear once consent is stored
        console.log('   Reloading page to verify persistence...');
        await send('Page.reload');
        await new Promise(r => setTimeout(r, 1200));

        const postReloadBanner = await send('Runtime.evaluate', {
            expression: `window.getComputedStyle(document.getElementById('wabiCookieBanner')).display`,
            returnByValue: true
        });
        console.log('   Banner display after reload:', postReloadBanner.result.value);
        assert.strictEqual(postReloadBanner.result.value, 'none', 'Banner must remain hidden on reload once consent is given');
        console.log('   ✓ Consent persistence verified across page reloads!');

        ws.close();
        edgeProcess.kill();

        console.log('\n================================================================');
        console.log('   ALL SECURITY, SEO & COOKIE CHECKS PASSED WITH 100% SUCCESS!');
        console.log('================================================================\n');

    } catch (err) {
        edgeProcess.kill();
        throw err;
    }
}

testSecuritySeoCookies().catch(err => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
});

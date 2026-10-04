const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'js', 'admin-shortcut.js'), 'utf8');

function createHarness({ pathname = '/', storageAvailable = true } = {}) {
    const values = new Map();
    const navigations = [];
    let clickHandler = null;
    let brandLogo;
    const location = {
        pathname,
        assign(destination) { navigations.push(destination); }
    };
    const sessionStorage = {
        getItem(key) {
            if (!storageAvailable) throw new Error('Storage unavailable');
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            if (!storageAvailable) throw new Error('Storage unavailable');
            values.set(key, String(value));
        },
        removeItem(key) {
            if (!storageAvailable) throw new Error('Storage unavailable');
            values.delete(key);
        }
    };
    const context = {
        document: {
            querySelector(selector) {
                assert.equal(selector, '.brand-logo');
                return brandLogo;
            }
        },
        window: { sessionStorage, location },
        Date,
        JSON,
        Number,
        Math,
        Set
    };

    function reloadAndBind(nextPath = location.pathname) {
        location.pathname = nextPath;
        clickHandler = null;
        brandLogo = {
            dataset: {},
            addEventListener(type, callback) {
                assert.equal(type, 'click');
                clickHandler = callback;
            }
        };
        vm.runInNewContext(script, context, { filename: 'admin-shortcut.js' });
    }

    function click(options = {}) {
        assert.equal(typeof clickHandler, 'function', 'The brand logo should have a click handler');
        let prevented = false;
        clickHandler({
            button: options.button ?? 0,
            metaKey: Boolean(options.metaKey),
            ctrlKey: Boolean(options.ctrlKey),
            shiftKey: Boolean(options.shiftKey),
            altKey: Boolean(options.altKey),
            preventDefault() { prevented = true; }
        });
        return prevented;
    }

    return { values, navigations, reloadAndBind, click };
}

function testFiveRapidTapsOnHome() {
    const harness = createHarness({ pathname: '/' });
    harness.reloadAndBind();
    for (let tap = 1; tap <= 4; tap += 1) {
        assert.equal(harness.click(), true, `Home tap ${tap} should avoid reloading the page`);
        assert.equal(harness.navigations.length, 0, 'The sign-in route should not open early');
    }
    assert.equal(harness.click(), true, 'The fifth tap should intercept the home link');
    assert.deepEqual(harness.navigations, ['/sanctuary']);
    assert.equal(harness.values.size, 0, 'The tap counter should reset after opening sign-in');
}

function testShortcutAcrossInitialHomeNavigation() {
    const harness = createHarness({ pathname: '/community' });
    harness.reloadAndBind('/community');
    assert.equal(harness.click(), false, 'The first logo click from another page should keep normal navigation');
    assert.equal(JSON.parse(harness.values.get('wabi_admin_logo_taps')).count, 1);

    harness.reloadAndBind('/home.html');
    for (let tap = 2; tap <= 4; tap += 1) {
        assert.equal(harness.click(), true, 'Subsequent taps on the home page should not reload it');
        assert.equal(harness.navigations.length, 0);
    }
    assert.equal(harness.click(), true, 'The fifth total tap should open the sign-in page');
    assert.deepEqual(harness.navigations, ['/sanctuary']);
}

function testWorksWhenSessionStorageIsUnavailable() {
    const harness = createHarness({ pathname: '/', storageAvailable: false });
    harness.reloadAndBind();
    for (let tap = 1; tap <= 4; tap += 1) {
        assert.equal(harness.click(), true, 'Home taps should remain countable without browser storage');
    }
    assert.equal(harness.click(), true);
    assert.deepEqual(harness.navigations, ['/sanctuary']);
}

function testModifiedClicksStayNative() {
    const harness = createHarness({ pathname: '/' });
    harness.reloadAndBind();
    assert.equal(harness.click({ ctrlKey: true }), false);
    assert.equal(harness.values.size, 0, 'Modified clicks must not increment the hidden shortcut');
    assert.equal(harness.navigations.length, 0);
}

function testLogoPagesLoadShortcut() {
    const pages = ['home.html', 'community.html', 'table-room.html', 'wabi-wall.html', 'login.html', 'sanctuary.html'];
    for (const page of pages) {
        const html = fs.readFileSync(path.join(root, 'pages', page), 'utf8');
        assert.match(html, /class="brand-logo"/, `${page} should include the Wabi Sabi logo link`);
        assert.match(html, /\.\.\/js\/admin-shortcut\.js/, `${page} should load the hidden admin shortcut`);
    }
    assert.match(script, /REQUIRED_TAPS\s*=\s*5/);
    assert.match(script, /location\.assign\('\/sanctuary'\)/);
}

testFiveRapidTapsOnHome();
testShortcutAcrossInitialHomeNavigation();
testWorksWhenSessionStorageIsUnavailable();
testModifiedClicksStayNative();
testLogoPagesLoadShortcut();
console.log('✓ Five rapid logo clicks navigate to admin sign-in without reloading home; browser storage fallback and native modified clicks are covered.');

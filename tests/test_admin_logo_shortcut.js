const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'js', 'admin-shortcut.js'), 'utf8');

function createHarness() {
    const values = new Map();
    const navigations = [];
    let clickHandler = null;
    let brandLogo;

    const context = {
        document: {
            querySelector(selector) {
                assert.equal(selector, '.brand-logo');
                return brandLogo;
            }
        },
        window: {
            sessionStorage: {
                getItem(key) { return values.has(key) ? values.get(key) : null; },
                setItem(key, value) { values.set(key, String(value)); },
                removeItem(key) { values.delete(key); }
            },
            location: {
                assign(destination) { navigations.push(destination); }
            }
        },
        Date,
        JSON,
        Number,
        Math
    };

    function reloadAndBind() {
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

function testFiveLogoTaps() {
    const harness = createHarness();
    for (let tap = 1; tap <= 4; tap += 1) {
        harness.reloadAndBind();
        assert.equal(harness.click(), false, `Tap ${tap} should preserve normal logo navigation`);
        assert.equal(harness.navigations.length, 0, 'The sign-in route should not open early');
    }

    harness.reloadAndBind();
    assert.equal(harness.click(), true, 'The fifth tap should intercept the home link');
    assert.deepEqual(harness.navigations, ['/sanctuary']);
    assert.equal(harness.values.size, 0, 'The tap counter should reset after opening sign-in');
}

function testModifiedClicksStayNative() {
    const harness = createHarness();
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

testFiveLogoTaps();
testModifiedClicksStayNative();
testLogoPagesLoadShortcut();
console.log('✓ Five logo clicks open the existing admin sign-in route; normal navigation and modified clicks remain intact.');

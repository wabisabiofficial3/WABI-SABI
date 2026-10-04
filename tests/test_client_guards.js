const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function assert(condition, message) {
    if (!condition) {
        console.error('❌ Assertion failed:', message);
        process.exit(1);
    }
}

console.log('Verifying client-side page protection & store script inclusions...');

const pages = path.join(root, 'pages');

const commHtml = fs.readFileSync(path.join(pages, 'community.html'), 'utf8');
assert(commHtml.includes('store.js'), 'community.html missing store.js');

const wabiHtml = fs.readFileSync(path.join(pages, 'wabi-wall.html'), 'utf8');
assert(wabiHtml.includes('store.js'), 'wabi-wall.html missing store.js');

const tableHtml = fs.readFileSync(path.join(pages, 'table-room.html'), 'utf8');
assert(tableHtml.includes('store.js'), 'table-room.html missing store.js');

const readerHtml = fs.readFileSync(path.join(pages, 'reader.html'), 'utf8');
assert(readerHtml.includes('store.js'), 'reader.html missing store.js');

const commJs = fs.readFileSync(path.join(root, 'js', 'community.js'), 'utf8');
assert(commJs.includes('requireAuth'), 'community.js missing requireAuth()');

const wabiJs = fs.readFileSync(path.join(root, 'js', 'wabi-wall.js'), 'utf8');
assert(wabiJs.includes('requireAuth'), 'wabi-wall.js missing requireAuth()');

const tableJs = fs.readFileSync(path.join(root, 'js', 'table-room.js'), 'utf8');
assert(tableJs.includes('requireAuth'), 'table-room.js missing requireAuth()');

const readerJs = fs.readFileSync(path.join(root, 'js', 'reader.js'), 'utf8');
assert(readerJs.includes('await window.WabiSabiStore.requireAuth'), 'reader.js missing await requireAuth()');

const storeJs = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');
assert(storeJs.includes("'/api/member/status'"), 'store.js must verify member sessions with the server');
assert(storeJs.includes('/my-space?returnTo='), 'unauthenticated member spaces should lead to member-code access');

const homeHtml = fs.readFileSync(path.join(pages, 'home.html'), 'utf8');
for (const route of ['/community', '/reader', '/table-room', '/wabi-wall']) {
    assert(homeHtml.includes(`href="${route}"`), `home.html missing a link to ${route}`);
}

for (const page of ['community.html', 'reader.html', 'table-room.html', 'wabi-wall.html']) {
    const html = fs.readFileSync(path.join(pages, page), 'utf8');
    for (const route of ['/community', '/reader', '/table-room', '/wabi-wall']) {
        assert(html.includes(`href="${route}"`), `${page} missing a shared-space navigation link to ${route}`);
    }
}

console.log('✅ MEMBER SESSION, CLIENT GUARD, AND CROSS-LINK CHECKS PASSED!');

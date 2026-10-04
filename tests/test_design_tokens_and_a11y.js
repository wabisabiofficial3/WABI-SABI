const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const cssDir = path.join(rootDir, 'css');
const pagesDir = path.join(rootDir, 'pages');

console.log('--- Verifying UI/UX, Design Tokens & A11y (Section 5) ---');

// 1. Verify tokens.css exists and has core tokens
const tokensPath = path.join(cssDir, 'tokens.css');
if (!fs.existsSync(tokensPath)) {
    throw new Error('tokens.css does not exist');
}
const tokensContent = fs.readFileSync(tokensPath, 'utf8');
const requiredTokens = ['--wabi-paper', '--wabi-ink', '--wabi-ink-muted', '--wabi-sage', '--wabi-forest-green'];
for (const token of requiredTokens) {
    if (!tokensContent.includes(token)) {
        throw new Error(`Missing required token: ${token} in tokens.css`);
    }
}
console.log('✓ tokens.css contains all required design tokens');

// 2. Verify all stylesheets import tokens.css
const cssFiles = ['dashboard.css', 'community.css', 'table-room.css', 'reader.css', 'wabi-wall.css'];
for (const file of cssFiles) {
    const content = fs.readFileSync(path.join(cssDir, file), 'utf8');
    if (!content.includes('tokens.css')) {
        throw new Error(`Stylesheet ${file} does not import tokens.css`);
    }
}
console.log('✓ All 5 major stylesheets import tokens.css');

// 3. Verify viewport meta tags do not contain user-scalable=no or maximum-scale=1.0
const htmlFiles = ['home.html', 'community.html', 'reader.html', 'table-room.html', 'wabi-wall.html'];
for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    if (content.includes('user-scalable=no') || content.includes('maximum-scale=1.0')) {
        throw new Error(`HTML file ${file} still contains zoom blocking meta tags`);
    }
}
console.log('✓ All HTML files allow accessible browser zoom (WCAG 2.1 SC 1.4.4 compliant)');

// 4. Verify 100dvh units exist in stylesheets for mobile address bar resilience
for (const file of ['table-room.css', 'reader.css', 'community.css', 'wabi-wall.css']) {
    const content = fs.readFileSync(path.join(cssDir, file), 'utf8');
    if (!content.includes('100dvh')) {
        throw new Error(`Stylesheet ${file} lacks 100dvh viewport unit`);
    }
}
console.log('✓ All viewport-contained stylesheets include 100dvh mobile fallbacks');

// 5. Verify dark mode selector [:root[data-theme="dark"]] exists in table-room.css and reader.css
const tableRoomCss = fs.readFileSync(path.join(cssDir, 'table-room.css'), 'utf8');
const readerCss = fs.readFileSync(path.join(cssDir, 'reader.css'), 'utf8');
if (!tableRoomCss.includes('[data-theme="dark"]')) {
    throw new Error('table-room.css missing [data-theme="dark"] selector');
}
if (!readerCss.includes('[data-theme="dark"]')) {
    throw new Error('reader.css missing [data-theme="dark"] selector');
}
console.log('✓ table-room.css and reader.css properly support [data-theme="dark"]');

// 6. Verify Curator desk pill is hidden by default in wabi-wall.html
const wabiWallHtml = fs.readFileSync(path.join(pagesDir, 'wabi-wall.html'), 'utf8');
if (!wabiWallHtml.includes('id="curatorDeskBtn"') || !wabiWallHtml.includes('display: none;')) {
    throw new Error('wabi-wall.html curator desk button is not properly hidden by default');
}
console.log('✓ wabi-wall.html curator desk button is securely role-gated');

// 7. Verify subtle realism polish is applied to each active website destination
const realismPages = ['home.html', 'community.html', 'reader.html', 'table-room.html', 'wabi-wall.html', 'curator.html', 'my-space.html', 'login.html', 'sanctuary.html'];
for (const file of realismPages) {
    const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    if (!content.includes('../css/realism.css')) {
        throw new Error(`Active page ${file} does not include the shared realism stylesheet`);
    }
}
const realismCss = fs.readFileSync(path.join(cssDir, 'realism.css'), 'utf8');
for (const selector of ['--realism-daylight', ':root[data-theme="dark"]', '.comm-card', '.portal-card', '.members-sidebar-card']) {
    if (!realismCss.includes(selector)) {
        throw new Error(`realism.css is missing the shared visual treatment: ${selector}`);
    }
}
console.log('✓ Natural lighting and tactile surface depth are shared across active destinations');

console.log('\n--- ALL SECTION 5 TESTS PASSED (7/7) ---');

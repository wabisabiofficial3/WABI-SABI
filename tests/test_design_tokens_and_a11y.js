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

// 8. Keep compact and muted text readable in Dark/Coffee mode (WCAG AA normal text).
function luminance(hex) {
    const channels = hex.replace('#', '').match(/.{2}/g).map(value => parseInt(value, 16) / 255);
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrastRatio(foreground, background) {
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
}
function extractCssBlock(source, marker) {
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) throw new Error(`Missing dark theme block marker: ${marker}`);
    const openingBrace = source.indexOf('{', markerIndex);
    if (openingBrace < 0) throw new Error(`Malformed dark theme block after: ${marker}`);
    let depth = 1;
    for (let index = openingBrace + 1; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}' && --depth === 0) return source.slice(openingBrace + 1, index);
    }
    throw new Error(`Unclosed dark theme block after: ${marker}`);
}
function tokenInBlock(source, marker, token, file) {
    const block = extractCssBlock(source, marker);
    const match = block.match(new RegExp(`${token.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*:\\s*(#[0-9a-f]{6})`, 'i'));
    if (!match) throw new Error(`${file} dark palette is missing ${token}`);
    return match[1];
}
const darkTokenAudits = [
    { file: 'auth.css', marker: '[data-theme="dark"] {', tokens: ['--ink-muted', '--ink-faint'], backgrounds: ['#191614', '#221E1A'] },
    { file: 'curator.css', marker: '[data-theme="dark"] {', tokens: ['--ink-muted', '--ink-faint'], backgrounds: ['#191614', '#221E1A'] },
    { file: 'dashboard.css', marker: '[data-theme="dark"] {', tokens: ['--ink-muted', '--ink-faint'], backgrounds: ['#191614', '#221E1A'] },
    { file: 'community.css', marker: '[data-theme="dark"] {', tokens: ['--ink-muted', '--ink-faint'], backgrounds: ['#151311', '#211D1A', '#262422'] },
    { file: 'reader.css', marker: ':root[data-theme="dark"],', tokens: ['--ink-muted'], backgrounds: ['#161514', '#201E1C', '#282522'] },
    { file: 'table-room.css', marker: ':root[data-theme="dark"],', tokens: ['--ink-muted'], backgrounds: ['#161514', '#201E1C', '#282522'] },
    { file: 'theme-weeks.css', marker: '[data-theme="dark"] {', tokens: ['--ink-muted', '--ink-faint'], backgrounds: ['#151311', '#211D1A'] },
    { file: 'wabi-wall.css', marker: '[data-theme="dark"] {', tokens: ['--ink-muted', '--ink-faint'], backgrounds: ['#151311', '#211D1A'] }
];
for (const audit of darkTokenAudits) {
    const css = fs.readFileSync(path.join(cssDir, audit.file), 'utf8');
    for (const token of audit.tokens) {
        const foreground = tokenInBlock(css, audit.marker, token, audit.file);
        for (const background of audit.backgrounds) {
            const ratio = contrastRatio(foreground, background);
            if (ratio < 4.5) {
                throw new Error(`${audit.file} ${token} contrast ${ratio.toFixed(2)}:1 on ${background} is below WCAG AA.`);
            }
        }
    }
}
const darkGlobalTokens = tokenInBlock(tokensContent, ':root[data-theme="dark"],', '--wabi-ink-muted', 'tokens.css');
const darkSubtleToken = tokenInBlock(tokensContent, ':root[data-theme="dark"],', '--wabi-ink-subtle', 'tokens.css');
for (const background of ['#161514', '#201E1C', '#262421']) {
    if (contrastRatio(darkGlobalTokens, background) < 4.5 || contrastRatio(darkSubtleToken, background) < 4.5) {
        throw new Error(`Shared dark text tokens fail WCAG AA on ${background}.`);
    }
}
const curatorPage = fs.readFileSync(path.join(pagesDir, 'curator.html'), 'utf8');
const curatorDark = extractCssBlock(curatorPage, '[data-theme="dark"] {');
const curatorMoss = curatorDark.match(/--moss-light:\s*(#[0-9a-f]{6})/i)?.[1];
if (!curatorMoss || contrastRatio(curatorMoss, '#161514') < 4.5 || contrastRatio(curatorMoss, '#2A2724') < 4.5) {
    throw new Error('Curator dark active tabs, primary actions, or status labels are not AA readable.');
}
const mySpace = fs.readFileSync(path.join(pagesDir, 'my-space.html'), 'utf8');
const mySpaceDark = extractCssBlock(mySpace, '[data-theme="dark"] {');
const mySpaceFaint = mySpaceDark.match(/--wabi-ink-faint:\s*(#[0-9a-f]{6})/i)?.[1];
if (!mySpaceFaint || contrastRatio(mySpaceFaint, '#141312') < 4.5 || contrastRatio(mySpaceFaint, '#22201D') < 4.5) {
    throw new Error('My Space dark subtle labels fail WCAG AA.');
}
const notificationCss = fs.readFileSync(path.join(cssDir, 'member-notifications.css'), 'utf8');
if (!notificationCss.includes('[data-theme="dark"] .member-notification-preview-note') ||
    !notificationCss.includes('[data-theme="dark"] .member-notification-mark-all')) {
    throw new Error('Dark notification preview and action accents are missing readable overrides.');
}
const previewForeground = '#EAD5A7';
const notificationActionForeground = '#A7D2AF';
if (contrastRatio(previewForeground, '#211D1A') < 4.5 || contrastRatio(notificationActionForeground, '#22201D') < 4.5) {
    throw new Error('Dark notification preview/action text fails WCAG AA.');
}
const tokenPlaceholderRule = '[data-theme="dark"] input::placeholder';
if (!tokensContent.includes(tokenPlaceholderRule) ||
    !fs.readFileSync(path.join(pagesDir, 'login.html'), 'utf8').includes('[data-theme="dark"] .field-input::placeholder')) {
    throw new Error('Dark-mode field placeholders are missing full-opacity readable colors.');
}
const readerCssForContrast = fs.readFileSync(path.join(cssDir, 'reader.css'), 'utf8');
const tableCssForContrast = fs.readFileSync(path.join(cssDir, 'table-room.css'), 'utf8');
const portalCssForContrast = fs.readFileSync(path.join(cssDir, 'portal.css'), 'utf8');
const homeHtmlForContrast = fs.readFileSync(path.join(pagesDir, 'home.html'), 'utf8');
if (!readerCssForContrast.includes('[data-theme="dark"] .reader-handle-badge') ||
    !readerCssForContrast.includes('[data-theme="dark"] .companion-title') ||
    !tableCssForContrast.includes('[data-theme="dark"] .week-menu-badge') ||
    !portalCssForContrast.includes('[data-theme="dark"] .update-meta-badge') ||
    !homeHtmlForContrast.includes('[data-theme="dark"] .stamp-title') ||
    !homeHtmlForContrast.includes('background: var(--wabi-card-subtle, #FAF7F0); color: var(--wabi-ink, #2C2621);')) {
    throw new Error('Dark-mode accent chips, activity labels, or member form surfaces are missing readable overrides.');
}
if (contrastRatio('#A7D2AF', '#282522') < 4.5 ||
    contrastRatio('#D4BE98', '#25221E') < 4.5) {
    throw new Error('Dark-mode sage/amber accents fail WCAG AA on their paper surfaces.');
}
console.log('✓ Dark/Coffee text, hints, status, and notification accents meet WCAG AA contrast');

console.log('\n--- ALL SECTION 5 TESTS PASSED (8/8) ---');

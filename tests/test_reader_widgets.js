// Automated syntax and DOM contract verification for reader.html, reader.css, and reader.js
const fs = require('fs');
const path = require('path');

function runReaderTests() {
    console.log('--- Verifying Reader Interactive Widgets & Book Switcher ---');

    const readerHtml = fs.readFileSync(path.join(__dirname, '../pages/reader.html'), 'utf8');
    const readerCss = fs.readFileSync(path.join(__dirname, '../css/reader.css'), 'utf8');
    const readerJs = fs.readFileSync(path.join(__dirname, '../js/reader.js'), 'utf8');

    // 1. Verify HTML elements exist
    const requiredHtml = [
        'id="bookTitleDropdownBtn"',
        'id="bookSwitcherMenu"',
        'data-book="atomic-habits"',
        'data-book="feminists"',
        'data-subtab="read"',
        'data-subtab="about"',
        'data-subtab="notes"',
        'data-subtab="discussions"',
        'id="readerAboutModal"',
        'id="readerAboutCloseBtn"',
        'id="aboutModalTitle"',
        'id="aboutReturnToReadBtn"'
    ];

    for (const token of requiredHtml) {
        if (!readerHtml.includes(token)) {
            throw new Error(`Missing expected HTML element in reader.html: ${token}`);
        }
    }
    console.log('✓ All expected HTML elements exist in reader.html');

    // 2. Verify CSS rules exist
    const requiredCss = [
        '.book-switcher-menu',
        '.book-switch-item',
        '.reader-about-backdrop',
        '.reader-about-paper',
        '.reader-about-close'
    ];

    for (const token of requiredCss) {
        if (!readerCss.includes(token)) {
            throw new Error(`Missing expected CSS rule in css/reader.css: ${token}`);
        }
    }
    console.log('✓ All expected styling rules exist in css/reader.css');

    // 3. Verify JS functionality
    const requiredJs = [
        'BOOKS_CATALOG',
        'switchActiveBook',
        'openAboutModal',
        'closeAboutModal',
        'updateAboutModalContent',
        'bookSwitchItems.forEach',
        'subtabs.forEach'
    ];

    for (const token of requiredJs) {
        if (!readerJs.includes(token)) {
            throw new Error(`Missing expected JS logic in js/reader.js: ${token}`);
        }
    }
    console.log('✓ All expected logic and event controllers exist in js/reader.js');

    console.log('\n--- READER WIDGETS VERIFICATION PASSED (3/3) ---');
}

runReaderTests();

const fs = require('fs');
const path = require('path');

function testHeroCtas() {
    console.log('--- Verifying Hero CTAs & Modal Integration ---');

    const homeHtml = fs.readFileSync(path.join(__dirname, '../pages/home.html'), 'utf8');
    const dashboardJs = fs.readFileSync(path.join(__dirname, '../js/dashboard.js'), 'utf8');

    if (!homeHtml.includes('id="introStoryModal"')) {
        throw new Error('introStoryModal missing from home.html');
    }
    if (!homeHtml.includes('id="introModalCloseBtn"')) {
        throw new Error('introModalCloseBtn missing from home.html');
    }
    console.log('✓ introStoryModal markup present in home.html');

    if (!dashboardJs.includes("window.location.href = 'reader.html'")) {
        throw new Error('getStartedBtn reader redirect missing in dashboard.js');
    }
    if (!dashboardJs.includes('openIntroModal')) {
        throw new Error('openIntroModal missing in dashboard.js');
    }
    if (dashboardJs.includes('e.ctrlKey) {') && dashboardJs.includes('e.preventDefault()')) {
        throw new Error('Zoom blocking event listener was not completely removed');
    }
    console.log('✓ Hero CTAs properly wired in dashboard.js');
    console.log('✓ Zoom blocking listener removed successfully (WCAG 2.1 SC 1.4.4)');

    console.log('\n--- HERO CTAS & ZOOM AUDIT PASSED (3/3) ---');
}

testHeroCtas();

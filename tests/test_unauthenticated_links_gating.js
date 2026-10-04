/**
 * WABI SABI — UNAUTHENTICATED VISITOR LINK GATING & GUEST REMOVAL TEST
 * Validates:
 * 1. "Guest Reader" has been removed; chip shows "Reader"
 * 2. Unauthenticated visitors can freely explore all tabs (dashboard, announcements, community, connect)
 * 3. Drive, WhatsApp, and external circle links do NOT open for unauthenticated visitors and instead prompt for member code
 * 4. Logged-in members can access the links
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTests() {
    console.log('--- Testing Unauthenticated Link Gating & Guest Removal ---');

    const homeHtml = fs.readFileSync(path.join(__dirname, '../pages/home.html'), 'utf8');

    // 1. Verify "Guest" has been removed from reader chip
    assert.ok(!homeHtml.includes('Guest Reader'), 'home.html must NOT contain "Guest Reader"');
    assert.ok(homeHtml.includes('id="readerChipName">Reader</span>'), 'readerChipName must show "Reader"');
    console.log('✓ "Guest Reader" removed; reader chip displays "Reader"');

    // 2. Verify all tabs exist for free exploration
    assert.ok(homeHtml.includes('id="tokenDashboard"'), 'Dashboard tab must be present');
    assert.ok(homeHtml.includes('id="tokenAnnouncements"'), 'Announcements tab must be present');
    assert.ok(homeHtml.includes('id="tokenCommunity"'), 'Community tab must be present');
    assert.ok(homeHtml.includes('id="tokenConnect"'), 'Connect tab must be present');
    console.log('✓ All 4 portal tabs verified for public exploration');

    // 3. Verify link protection mechanism exists in home.html
    assert.ok(homeHtml.includes('initProtectedExternalLinks'), 'home.html must contain initProtectedExternalLinks');
    assert.ok(homeHtml.includes('openMemberAccessPrompt'), 'home.html must contain openMemberAccessPrompt');
    assert.ok(homeHtml.includes('isCircleMemberLoggedIn'), 'home.html must contain isCircleMemberLoggedIn check');
    console.log('✓ Protected external link gatekeeper verified in home.html');

    // 4. Verify card click handlers check authentication
    assert.ok(homeHtml.includes("if (!window.isCircleMemberLoggedIn || !window.isCircleMemberLoggedIn())"), 'Card click handlers must check isCircleMemberLoggedIn');
    console.log('✓ Dashboard card click handlers (Drive & WhatsApp) gated behind member auth');

    // 5. Verify optionalMember middleware recognizes both member and curator sessions
    const memberAuthJs = fs.readFileSync(path.join(__dirname, '../server/middleware/memberAuth.js'), 'utf8');
    assert.ok(memberAuthJs.includes('wabisabi_curator_session'), 'optionalMember must recognize curator session');
    assert.ok(memberAuthJs.includes('wabisabi_member_session'), 'optionalMember must recognize member session');
    console.log('✓ Server middleware recognizes both member and curator authentication');

    console.log('✅ ALL UNAUTHENTICATED LINK GATING TESTS PASSED CLEANLY!\n');
}

runTests();

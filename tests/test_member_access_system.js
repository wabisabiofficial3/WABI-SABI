const { baseUrl: BASE_URL, ADMIN_PASSWORD } = require('./test_config');
const { createMember, deleteMember } = require('../server/db');
const assert = require('node:assert');

async function runMemberAccessTests() {
    console.log('================================================================');
    console.log('   WABI SABI MEMBER-ACCESS SYSTEM SPECIFICATION AUDIT');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // 1. PUBLIC VISITOR EXPLORATION & PRIVACY PRESERVATION
    // -------------------------------------------------------------
    console.log('► 1. Verifying Public Visitor Freedom & Data Privacy Safeguards...');
    
    // Public portal endpoint
    const portalRes = await fetch(`${BASE_URL}/api/portal`);
    assert.strictEqual(portalRes.status, 200, 'GET /api/portal must return 200');
    const portalData = await portalRes.json();
    assert.strictEqual(portalData.success, true);
    const members = (portalData.community && portalData.community.members) || portalData.members || [];
    assert(Array.isArray(members) && members.length > 0, 'Portal data must include members array');

    // CRITICAL: Ensure NO sensitive credentials, gender, or private notes are exposed publicly
    for (const m of members) {
        assert.strictEqual(m.secret_code_hash, undefined, 'Secret code hash must NEVER be exposed in public API');
        assert.strictEqual(m.secret_code, undefined, 'Secret code must NEVER be exposed in public API');
        assert.strictEqual(m.secretCode, undefined, 'Secret code must NEVER be exposed in public API');
        assert.strictEqual(m.gender, undefined, 'Member gender is personal and must NOT be exposed in public API');
        assert.strictEqual(m.personal_notes, undefined, 'Private notes must NOT be exposed in public API');
    }
    console.log(`   ✓ Verified ${members.length} public community member cards (100% sanitized).`);

    // Public member status check without cookie
    const statusRes = await fetch(`${BASE_URL}/api/member/status`);
    assert.strictEqual(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.strictEqual(statusData.authenticated, false, 'Unauthenticated public visitor must have authenticated: false');
    console.log('   ✓ Public visitor acknowledged without any login barrier.');

    // -------------------------------------------------------------
    // 2. SECRET CODE VERIFICATION & HTTP-ONLY COOKIE SESSIONS
    // -------------------------------------------------------------
    console.log('\n► 2. Testing Secret Code Verification & Secure Session Issuance...');

    // Invalid secret code
    const invalidCodeRes = await fetch(`${BASE_URL}/api/member/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: 'WS-INVALID-CODE-XXXX' })
    });
    assert.strictEqual(invalidCodeRes.status, 401, 'Invalid code must be rejected with 401');
    const invalidJson = await invalidCodeRes.json();
    assert.strictEqual(invalidJson.success, false);
    console.log('   ✓ Non-existent secret code properly rejected with 401 Unauthorized.');

    // Issue a fresh code for the seeded member instead of relying on a committed code.
    const bootstrapLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'wabisabiofficial3@gmail.com', password: ADMIN_PASSWORD })
    });
    assert.strictEqual(bootstrapLoginRes.status, 200, 'Admin login must succeed for fixture setup.');
    const bootstrapCookie = bootstrapLoginRes.headers.get('set-cookie').split(';')[0];
    const fixtureMember = createMember({
        name: 'Member Access Fixture',
        full_name: 'Member Access Fixture',
        display_name: 'Member Access Fixture',
        role: 'Member',
        handle: '@member-access-fixture',
        bio: 'Temporary member-access test record.'
    });
    const fixtureMemberId = fixtureMember.id;
    const freshCodeRes = await fetch(`${BASE_URL}/api/curator/members/${fixtureMemberId}/regenerate-code`, {
        method: 'POST',
        headers: { 'Cookie': bootstrapCookie }
    });
    assert.strictEqual(freshCodeRes.status, 200, 'Curator must be able to issue a fresh member code.');
    const freshCode = (await freshCodeRes.json()).secretCode;
    assert.match(freshCode, /^WS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);

    const validCodeRes = await fetch(`${BASE_URL}/api/member/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: freshCode })
    });
    assert.strictEqual(validCodeRes.status, 200, 'Valid code must return 200 OK');
    const validJson = await validCodeRes.json();
    assert.strictEqual(validJson.success, true);
    assert.strictEqual(validJson.redirectUrl, '/my-space');
    assert.strictEqual(validJson.member.name, 'Member Access Fixture');

    // Validate Set-Cookie header
    const setCookieHeader = validCodeRes.headers.get('set-cookie');
    assert(setCookieHeader && setCookieHeader.includes('wabisabi_member_session='), 'Must set wabisabi_member_session cookie');
    assert(setCookieHeader.toLowerCase().includes('httponly'), 'Member session cookie MUST have HttpOnly flag');
    assert(setCookieHeader.toLowerCase().includes('samesite=lax'), 'Member session cookie MUST have SameSite=Lax flag');

    const memberCookie = setCookieHeader.split(';')[0];
    console.log(`   ✓ Secret code accepted! Secure HttpOnly session issued: ${memberCookie}`);

    // -------------------------------------------------------------
    // 3. MEMBER DESK RECOGNITION & HYDRATION (/my-space)
    // -------------------------------------------------------------
    console.log('\n► 3. Testing Member Desk Hydration & Private Margin Notes...');

    // Member status recognition with cookie
    const memberStatusRes = await fetch(`${BASE_URL}/api/member/status`, {
        headers: { 'Cookie': memberCookie }
    });
    assert.strictEqual(memberStatusRes.status, 200);
    const memberStatusData = await memberStatusRes.json();
    assert.strictEqual(memberStatusData.authenticated, true);
    assert.strictEqual(memberStatusData.member.name, 'Member Access Fixture');
    console.log('   ✓ Member session recognized on server (/api/member/status).');

    // Full desk data hydration (/api/member/me)
    const meRes = await fetch(`${BASE_URL}/api/member/me`, {
        headers: { 'Cookie': memberCookie }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.success, true);
    assert.strictEqual(meData.member.name, 'Member Access Fixture');
    assert.strictEqual(meData.member.handle, '@member-access-fixture');
    assert.strictEqual(meData.member.status, 'active');
    assert(meData.reading && meData.reading.bookTitle, 'Member reading data must be populated');
    assert(Array.isArray(meData.notes), 'Member private notes array must be populated');
    assert(meData.gathering, 'Next gathering information must be present');
    console.log(`   ✓ Member Desk hydrated: Currently reading "${meData.reading.bookTitle}" (${meData.reading.progressPercent}%)`);

    // -------------------------------------------------------------
    // 4. INTERACTIVE MEMBER ACTIONS (Reading Progress & Margin Notes)
    // -------------------------------------------------------------
    console.log('\n► 4. Testing Reading Progress Updates & Private Notes Lifecycle...');

    // Update reading progress to 84%
    const updateReadingRes = await fetch(`${BASE_URL}/api/member/reading`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': memberCookie
        },
        body: JSON.stringify({ progressPercent: 84 })
    });
    assert.strictEqual(updateReadingRes.status, 200);
    const updateReadingJson = await updateReadingRes.json();
    assert.strictEqual(updateReadingJson.success, true);
    assert.strictEqual(updateReadingJson.reading.progressPercent, 84);

    // Verify persistence via GET /api/member/me
    const verifyReadingRes = await fetch(`${BASE_URL}/api/member/me`, {
        headers: { 'Cookie': memberCookie }
    });
    const verifyReadingData = await verifyReadingRes.json();
    assert.strictEqual(verifyReadingData.reading.progressPercent, 84);
    console.log('   ✓ Reading progress successfully updated and persisted at 84%.');

    // Add private margin note
    const addNoteRes = await fetch(`${BASE_URL}/api/member/notes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': memberCookie
        },
        body: JSON.stringify({ noteText: '“In the depth of winter, I finally learned that within me there lay an invincible summer.”' })
    });
    assert.strictEqual(addNoteRes.status, 200);
    const addNoteJson = await addNoteRes.json();
    assert.strictEqual(addNoteJson.success, true);
    const createdNoteId = addNoteJson.note.id;
    assert(createdNoteId, 'Note ID must be returned');
    console.log(`   ✓ Added private note #${createdNoteId}: "${addNoteJson.note.noteText.slice(0, 40)}..."`);

    // Delete the created note
    const deleteNoteRes = await fetch(`${BASE_URL}/api/member/notes/${createdNoteId}`, {
        method: 'DELETE',
        headers: { 'Cookie': memberCookie }
    });
    assert.strictEqual(deleteNoteRes.status, 200);
    console.log('   ✓ Private note successfully deleted.');

    // -------------------------------------------------------------
    // 5. SESSION TERMINATION (Leave My Space)
    // -------------------------------------------------------------
    console.log('\n► 5. Testing Member Desk Departure (Leave My Space)...');

    const leaveRes = await fetch(`${BASE_URL}/api/member/leave`, {
        method: 'POST',
        headers: { 'Cookie': memberCookie }
    });
    assert.strictEqual(leaveRes.status, 200);
    const leaveSetCookie = leaveRes.headers.get('set-cookie');
    assert(leaveSetCookie && (leaveSetCookie.includes('Max-Age=0') || leaveSetCookie.includes('Expires=')), 'Session cookie must be cleared on leave');

    // Calling /api/member/me with invalidated cookie must now return 401
    const unauthedRes = await fetch(`${BASE_URL}/api/member/me`, {
        headers: { 'Cookie': memberCookie }
    });
    assert.strictEqual(unauthedRes.status, 401, 'Invalidated session must return 401');
    assert.strictEqual(deleteMember(fixtureMemberId), 1, 'Temporary member fixture must be removed after verification.');
    console.log('   ✓ Member session securely revoked and temporary fixture removed.');

    // -------------------------------------------------------------
    // 6. CURATOR STUDIO MEMBER DIRECTORY OPERATIONS
    // -------------------------------------------------------------
    console.log('\n► 6. Testing Curator Studio Member Management Lifecycle...');

    // Curator login
    const curatorLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'wabisabiofficial3@gmail.com',
            password: ADMIN_PASSWORD
        })
    });
    assert.strictEqual(curatorLoginRes.status, 200, 'Curator login must succeed');
    const curatorCookie = curatorLoginRes.headers.get('set-cookie').split(';')[0];
    console.log(`   ✓ Authenticated Curator session acquired.`);

    // Curator creates a new member
    const newMemberPayload = {
        name: 'Kavya Raman',
        full_name: 'Kavya Raman',
        display_name: 'Kavya',
        handle: '@kavya',
        gender: 'Female',
        role: 'Member',
        date_joined: '2026-10-02',
        avatar_url: '../assets/avatar_aishwarya.jpg',
        bio: 'Philosophy, Japanese poetics, and quiet afternoons with tea.'
    };

    const createMemberRes = await fetch(`${BASE_URL}/api/curator/members`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': curatorCookie
        },
        body: JSON.stringify(newMemberPayload)
    });
    assert(createMemberRes.status === 200 || createMemberRes.status === 201, 'Create member status must be 200 or 201');
    const createMemberJson = await createMemberRes.json();
    assert.strictEqual(createMemberJson.success, true);
    assert(createMemberJson.member && createMemberJson.member.id, 'Created member must have ID');
    assert(createMemberJson.secretCode, 'Curator response must provide newly generated Secret Code');

    const createdMemberId = createMemberJson.member.id;
    const initialSecretCode = createMemberJson.secretCode;
    assert(/^WS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(initialSecretCode), `Code format must match WS-XXXX-XXXX-XXXX (got: ${initialSecretCode})`);
    console.log(`   ✓ Created Member "${newMemberPayload.name}" with Secret Code: ${initialSecretCode}`);

    // Verify member can access desk with the generated Secret Code
    const memberLoginRes = await fetch(`${BASE_URL}/api/member/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: initialSecretCode })
    });
    assert.strictEqual(memberLoginRes.status, 200);
    const memberLoginJson = await memberLoginRes.json();
    assert(memberLoginJson.member.name === 'Kavya' || memberLoginJson.member.name === 'Kavya Raman', 'Member name must match display or full name');
    const testMemberCookie = memberLoginRes.headers.get('set-cookie').split(';')[0];
    console.log('   ✓ Newly created member successfully entered My Space using their Secret Code.');

    // Curator Preview Mode (/my-space?preview={id})
    const previewRes = await fetch(`${BASE_URL}/api/member/me?preview=${createdMemberId}`, {
        headers: { 'Cookie': curatorCookie }
    });
    assert.strictEqual(previewRes.status, 200);
    const previewJson = await previewRes.json();
    assert.strictEqual(previewJson.success, true);
    assert.strictEqual(previewJson.isCuratorPreview, true, 'Desk must indicate Curator Preview mode');
    assert.strictEqual(previewJson.member.id, createdMemberId);
    console.log('   ✓ Curator Preview Mode verified: Curator can view member desk without having member secret code.');

    // Regenerate Secret Code
    console.log('\n   Sub-test: Secret Code Regeneration & Invalidation...');
    const regenRes = await fetch(`${BASE_URL}/api/curator/members/${createdMemberId}/regenerate-code`, {
        method: 'POST',
        headers: { 'Cookie': curatorCookie }
    });
    assert.strictEqual(regenRes.status, 200);
    const regenJson = await regenRes.json();
    assert.strictEqual(regenJson.success, true);
    const regeneratedCode = regenJson.secretCode;
    assert.notStrictEqual(regeneratedCode, initialSecretCode, 'Regenerated code must differ from initial code');
    console.log(`   ✓ Regenerated Secret Code: ${regeneratedCode}`);

    // Verify previous code is immediately invalidated
    const oldCodeLoginRes = await fetch(`${BASE_URL}/api/member/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: initialSecretCode })
    });
    assert.strictEqual(oldCodeLoginRes.status, 401, 'Old secret code must be rejected with 401');
    console.log('   ✓ Previous secret code successfully invalidated.');

    // Verify new code works
    const newCodeLoginRes = await fetch(`${BASE_URL}/api/member/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: regeneratedCode })
    });
    assert.strictEqual(newCodeLoginRes.status, 200, 'New secret code must be accepted');
    const activeTestMemberCookie = newCodeLoginRes.headers.get('set-cookie').split(';')[0];
    console.log('   ✓ New secret code successfully authenticated.');

    // Suspend Membership
    console.log('\n   Sub-test: Membership Suspension & Session Revocation...');
    const suspendRes = await fetch(`${BASE_URL}/api/curator/members/${createdMemberId}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': curatorCookie
        },
        body: JSON.stringify({ status: 'suspended' })
    });
    assert.strictEqual(suspendRes.status, 200);

    // Active session must immediately be blocked
    const suspendedDeskRes = await fetch(`${BASE_URL}/api/member/me`, {
        headers: { 'Cookie': activeTestMemberCookie }
    });
    assert(suspendedDeskRes.status === 401 || suspendedDeskRes.status === 403, 'Suspended member session must be revoked (401 or 403)');
    console.log('   ✓ Active session for suspended member blocked immediately.');

    // Login attempt by suspended member must be blocked
    const suspendedLoginRes = await fetch(`${BASE_URL}/api/member/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: regeneratedCode })
    });
    assert.strictEqual(suspendedLoginRes.status, 403, 'Login for suspended member must return 403 Forbidden');
    console.log('   ✓ Login for suspended member blocked.');

    // Restore Membership
    const restoreRes = await fetch(`${BASE_URL}/api/curator/members/${createdMemberId}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': curatorCookie
        },
        body: JSON.stringify({ status: 'active' })
    });
    assert.strictEqual(restoreRes.status, 200);

    // Login now works again
    const restoredLoginRes = await fetch(`${BASE_URL}/api/member/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: regeneratedCode })
    });
    assert.strictEqual(restoredLoginRes.status, 200, 'Restored member login must succeed');
    console.log('   ✓ Restored member can access desk again.');

    // -------------------------------------------------------------
    // 7. PHYSICAL CARD & ONE-TIME QR CLAIM PASS
    // -------------------------------------------------------------
    console.log('\n► 7. Testing Physical Membership Card QR Pass Generation...');

    const qrGenRes = await fetch(`${BASE_URL}/api/curator/members/${createdMemberId}/generate-qr`, {
        method: 'POST',
        headers: { 'Cookie': curatorCookie }
    });
    assert.strictEqual(qrGenRes.status, 200);
    const qrJson = await qrGenRes.json();
    assert.strictEqual(qrJson.success, true);
    assert(qrJson.token, 'QR token must be returned');
    assert(qrJson.claimUrl && qrJson.claimUrl.includes(qrJson.token), 'Claim URL must include token');
    assert(qrJson.qrDataUrl && qrJson.qrDataUrl.startsWith('data:image/png;base64,'), 'QR data URL must be generated');
    console.log(`   ✓ Physical membership card pass generated with embedded QR data URL.`);

    // A simple GET (such as a mail/security scanner) must not consume a pass.
    const previewPassRes = await fetch(qrJson.claimUrl, { redirect: 'manual' });
    assert.strictEqual(previewPassRes.status, 200, 'Opening the QR URL should show a confirmation page.');
    assert((await previewPassRes.text()).includes('method=\"post\"'), 'Confirmation must require a deliberate POST.');
    assert.strictEqual(previewPassRes.headers.get('set-cookie'), null, 'GET must not issue a member session.');

    // Consume the one-time pass by submitting the confirmation form.
    const claimRes = await fetch(`${BASE_URL}/api/member/claim-pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: qrJson.token }),
        redirect: 'manual'
    });
    assert.strictEqual(claimRes.status, 302, 'Claim POST must redirect to /my-space');
    assert.strictEqual(claimRes.headers.get('location'), '/my-space');
    const claimCookie = claimRes.headers.get('set-cookie');
    assert(claimCookie && claimCookie.includes('wabisabi_member_session='), 'Claim pass must establish member session cookie');
    console.log('   ✓ Claim pass successfully established authenticated member session.');

    // Second confirmation with the same token must fail (single-use protection).
    const replayClaimRes = await fetch(`${BASE_URL}/api/member/claim-pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: qrJson.token }),
        redirect: 'manual'
    });
    const replayLocation = replayClaimRes.headers.get('location') || '';
    assert.strictEqual(replayClaimRes.status, 302, 'Replayed claim must redirect with an error.');
    assert(replayLocation.includes('claim_error=invalid_or_expired'), 'Replayed claim must be rejected as expired or invalid.');
    console.log('   ✓ Replayed QR pass correctly rejected (single-use guarantee).');

    // -------------------------------------------------------------
    // 8. TEARDOWN / CLEANUP
    // -------------------------------------------------------------
    console.log('\n► 8. Cleaning Up Test Artifacts...');
    const deleteRes = await fetch(`${BASE_URL}/api/curator/members/${createdMemberId}`, {
        method: 'DELETE',
        headers: { 'Cookie': curatorCookie }
    });
    assert.strictEqual(deleteRes.status, 200);
    console.log(`   ✓ Test member #${createdMemberId} removed cleanly.`);

    console.log('\n================================================================');
    console.log('   ✦ ALL 8 MEMBER-ACCESS SYSTEM SPECIFICATIONS PASSED (100%)');
    console.log('================================================================\n');
}

if (require.main === module) {
    runMemberAccessTests().catch(err => {
        console.error('Member Access Audit Failed:', err);
        process.exit(1);
    });
}

module.exports = runMemberAccessTests;

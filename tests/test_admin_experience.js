const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { baseUrl: BASE_URL, ADMIN_PASSWORD } = require('./test_config');

async function request(route, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    let body = options.body;
    if (body !== undefined && typeof body !== 'string') {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }
    const response = await fetch(new URL(route, BASE_URL), { ...options, headers, body });
    const text = await response.text();
    let data = text;
    try { data = JSON.parse(text); } catch {}
    return { response, data, text };
}

function cookieValue(response, name) {
    const header = response.headers.get('set-cookie') || '';
    const match = header.match(new RegExp(`(?:^|[,; ]+)${name}=([^;,]+)`));
    assert(match, `Expected ${name} cookie from server.`);
    return `${name}=${match[1]}`;
}

async function loginCurator() {
    const result = await request('/api/auth/login', {
        method: 'POST',
        body: { identifier: 'wabisabiofficial3@gmail.com', password: ADMIN_PASSWORD }
    });
    assert.equal(result.response.status, 200);
    return cookieValue(result.response, 'wabisabi_curator_session');
}

async function createMember(cookie, name, handle) {
    const result = await request('/api/curator/members', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: { name, display_name: name, role: 'Member', handle }
    });
    assert.equal(result.response.status, 201, result.text);
    assert.equal(result.data.notificationsCreated, 1, 'Adding an active member creates a community notice.');
    return result.data;
}

async function accessMember(code) {
    const result = await request('/api/member/access', {
        method: 'POST',
        body: { secretCode: code }
    });
    assert.equal(result.response.status, 200, result.text);
    return cookieValue(result.response, 'wabisabi_member_session');
}

async function getFeed(cookie) {
    const result = await request('/api/member/notifications', { headers: { Cookie: cookie } });
    assert.equal(result.response.status, 200, result.text);
    assert.equal(result.data.success, true);
    return result.data;
}

async function run() {
    const unauthenticated = await request('/api/member/notifications');
    assert.equal(unauthenticated.response.status, 401, 'Notification feeds require member authentication.');

    const noticesResponse = await fetch(new URL('/api/notices', BASE_URL), { redirect: 'manual' });
    assert.equal(noticesResponse.status, 200, 'Wabi Wall should use its active notice API, not redirect to the portal.');
    const noticesBody = await noticesResponse.json();
    assert.equal(noticesBody.success, true);
    assert(Array.isArray(noticesBody.notices));

    const curatorCookie = await loginCurator();
    const memberA = await createMember(curatorCookie, 'Notification Test Mira', '@notify-mira');
    const memberB = await createMember(curatorCookie, 'Notification Test Dev', '@notify-dev');
    const cookieA = await accessMember(memberA.secretCode);
    let cookieB = await accessMember(memberB.secretCode);

    const adminSession = await request('/api/auth/session', { headers: { Cookie: curatorCookie } });
    assert.equal(adminSession.response.status, 200);
    const originalAdminName = adminSession.data.curator.displayName;
    const changedAdminName = `${originalAdminName} Preview Test`;
    const adminProfileSave = await request('/api/curator/profile', {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { displayName: changedAdminName }
    });
    assert.equal(adminProfileSave.response.status, 200, adminProfileSave.text);
    assert.equal(adminProfileSave.data.notificationsCreated, 1, 'A public admin-directory name change notifies members.');
    assert((await getFeed(cookieB)).notifications.some(item => item.kind === 'community' && item.message.includes(changedAdminName)));
    const adminProfileNoOp = await request('/api/curator/profile', {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { displayName: changedAdminName }
    });
    assert.equal(adminProfileNoOp.response.status, 200);
    assert.equal(adminProfileNoOp.data.notificationsCreated, 0, 'A no-op admin profile save does not duplicate a broadcast.');
    const restoreAdminProfile = await request('/api/curator/profile', {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { displayName: originalAdminName }
    });
    assert.equal(restoreAdminProfile.response.status, 200);
    assert.equal(restoreAdminProfile.data.notificationsCreated, 1);

    // New accounts receive only broadcasts created after they were registered.
    const feedAAfterSetup = await getFeed(cookieA);
    const feedBAfterSetup = await getFeed(cookieB);
    const miraWelcome = feedAAfterSetup.notifications.find(item => item.kind === 'community' && item.message.includes('Notification Test Mira'));
    assert(miraWelcome, 'The newly registered member receives the community-join update.');
    assert(!feedBAfterSetup.notifications.some(item => item.id === miraWelcome.id), 'Later accounts do not inherit earlier broadcasts.');

    const bulletinTitle = 'Admin preview notification bulletin 2026';
    const bulletin = await request('/api/curator/updates', {
        method: 'POST',
        headers: { Cookie: curatorCookie },
        body: { title: bulletinTitle, content: 'A test bulletin saved through the management console.' }
    });
    assert.equal(bulletin.response.status, 201, bulletin.text);
    assert.equal(bulletin.data.notificationsCreated, 1);
    const bulletinId = bulletin.data.updateId;

    const bulletinFeedA = await getFeed(cookieA);
    const bulletinFeedB = await getFeed(cookieB);
    const bulletinNotificationA = bulletinFeedA.notifications.find(item => item.kind === 'bulletin' && item.message.includes(bulletinTitle));
    const bulletinNotificationB = bulletinFeedB.notifications.find(item => item.id === bulletinNotificationA?.id);
    assert(bulletinNotificationA, 'Member A receives a change-specific bulletin notification.');
    assert(bulletinNotificationB, 'Member B receives the same broadcast.');
    assert.equal(bulletinNotificationA.href, '/#announcements');
    assert.equal(bulletinNotificationA.isRead, false);
    assert.equal(bulletinNotificationB.isRead, false);

    const previewFeed = await request(`/api/member/notifications?preview=${encodeURIComponent(memberA.memberId)}`, {
        headers: { Cookie: curatorCookie }
    });
    assert.equal(previewFeed.response.status, 200, previewFeed.text);
    assert.equal(previewFeed.data.isCuratorPreview, true);
    assert(previewFeed.data.notifications.some(item => item.id === bulletinNotificationA.id));

    // A curator preview is read-only at the API boundary, not merely in the page controls.
    const beforePreview = await request(`/api/member/me?preview=${encodeURIComponent(memberA.memberId)}`, {
        headers: { Cookie: curatorCookie }
    });
    assert.equal(beforePreview.response.status, 200);
    assert.equal(beforePreview.data.reading.progress, 0);
    const previewReadingWrite = await request(`/api/member/reading?preview=${encodeURIComponent(memberA.memberId)}`, {
        method: 'POST',
        headers: { Cookie: curatorCookie },
        body: { progress: 91 }
    });
    assert.equal(previewReadingWrite.response.status, 403);
    const previewNoteWrite = await request(`/api/member/notes?preview=${encodeURIComponent(memberA.memberId)}`, {
        method: 'POST',
        headers: { Cookie: curatorCookie },
        body: { content: 'A curator must not be able to save into this member desk from preview.' }
    });
    assert.equal(previewNoteWrite.response.status, 403);
    const afterPreview = await request(`/api/member/me?preview=${encodeURIComponent(memberA.memberId)}`, {
        headers: { Cookie: curatorCookie }
    });
    assert.equal(afterPreview.data.reading.progress, 0, 'Preview writes never change the member’s reading progress.');
    assert.equal(afterPreview.data.notes.length, 0, 'Preview writes never change private notes.');

    const previewMarkRead = await request(`/api/member/notifications/${bulletinNotificationA.id}/read?preview=${encodeURIComponent(memberA.memberId)}`, {
        method: 'POST',
        headers: { Cookie: curatorCookie }
    });
    assert.equal(previewMarkRead.response.status, 403, 'A preview cannot mutate notification read state.');

    // A member can mark their copy read without changing another member's receipt.
    const markedRead = await request(`/api/member/notifications/${bulletinNotificationA.id}/read`, {
        method: 'POST',
        headers: { Cookie: cookieA }
    });
    assert.equal(markedRead.response.status, 200, markedRead.text);
    assert.equal((await getFeed(cookieA)).notifications.find(item => item.id === bulletinNotificationA.id).isRead, true);
    assert.equal((await getFeed(cookieB)).notifications.find(item => item.id === bulletinNotificationB.id).isRead, false);
    const crossMemberRead = await request(`/api/member/notifications/${miraWelcome.id}/read`, {
        method: 'POST',
        headers: { Cookie: cookieB }
    });
    assert.equal(crossMemberRead.response.status, 404, 'A member cannot mark an unassigned notification as read.');

    // The personal bookshelf comes from that member's stored reading rows, not shared demo titles.
    const shelfBefore = await request('/api/member/me', { headers: { Cookie: cookieB } });
    assert.equal(shelfBefore.response.status, 200);
    assert.equal(shelfBefore.data.bookshelf[0].title, 'The Stranger');
    assert(!shelfBefore.data.bookshelf.some(book => book.title === 'In Praise of Shadows' || book.title === 'Norwegian Wood'));
    await request('/api/member/reading', {
        method: 'POST',
        headers: { Cookie: cookieB },
        body: { book_title: 'Dev’s saved selection', book_author: 'A Member', progress: 0 }
    });
    const shelfAfter = await request('/api/member/me', { headers: { Cookie: cookieB } });
    assert.equal(shelfAfter.data.bookshelf[0].title, 'Dev’s saved selection');
    assert.equal(shelfAfter.data.bookshelf[0].progress, 0);

    // Saved website content creates a typed notification, while a no-op save does not.
    const testTheme = { theme: 'Member notification theme 2026', subtitle: 'A change-specific test.' };
    const themeSave = await request('/api/curator/announcements', {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { weekly_theme: testTheme }
    });
    assert.equal(themeSave.response.status, 200, themeSave.text);
    assert.equal(themeSave.data.notificationsCreated, 1);
    const themeFeed = await getFeed(cookieB);
    const themeNotification = themeFeed.notifications.find(item => item.kind === 'theme' && item.message.includes(testTheme.theme));
    assert(themeNotification);
    assert.equal(themeNotification.href, '/#announcements');
    const themeNoOp = await request('/api/curator/announcements', {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { weekly_theme: testTheme }
    });
    assert.equal(themeNoOp.response.status, 200);
    assert.equal(themeNoOp.data.notificationsCreated, 0, 'An unchanged save does not send a duplicate notification.');
    assert.equal((await getFeed(cookieB)).notifications.filter(item => item.kind === 'theme' && item.message.includes(testTheme.theme)).length, 1);

    const readingTitle = 'Member notification shared reading 2026';
    const readingSave = await request('/api/curator/announcements', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { this_weeks_reading: { title: readingTitle, author: 'Regression Author', notes: 'Read together.', drive_url: '' } }
    });
    assert.equal(readingSave.response.status, 200);
    const readingNotification = (await getFeed(cookieB)).notifications.find(item => item.kind === 'reading' && item.message.includes(readingTitle));
    assert(readingNotification, 'Reading changes use a reading-specific message.');
    assert.notEqual(readingNotification.title, themeNotification.title, 'Different changes do not use a generic notification.');

    const gatheringMarker = 'Notification Regression Courtyard';
    const announcementChanges = await request('/api/curator/announcements', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: {
            gathering: { date: 'Saturday, 24 October 2026', time: '5:30 PM', location: gatheringMarker, maps_url: 'https://maps.google.com/?q=regression', note: 'Test details.' },
            discussion_points: ['What changes when a story is shared?', 'Which scene stayed with you?'],
            important_notes: 'Bring your annotated copy to the courtyard.'
        }
    });
    assert.equal(announcementChanges.response.status, 200, announcementChanges.text);
    assert.equal(announcementChanges.data.notificationsCreated, 3);
    const announcementFeed = await getFeed(cookieB);
    const gatheringNotice = announcementFeed.notifications.find(item => item.kind === 'gathering' && item.message.includes(gatheringMarker));
    const discussionNotice = announcementFeed.notifications.find(item => item.kind === 'discussion' && item.message.includes('What changes when a story is shared?'));
    const importantNotice = announcementFeed.notifications.find(item => item.kind === 'circle_note' && item.message.includes('annotated copy'));
    assert(gatheringNotice && discussionNotice && importantNotice, 'Gathering, discussion, and important-note changes each have distinct notices.');
    assert.equal(gatheringNotice.href, '/#announcements');

    const connectSave = await request('/api/curator/connect', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { community_chat_url: 'https://example.com/notification-chat' }
    });
    assert.equal(connectSave.response.status, 200, connectSave.text);
    assert.equal(connectSave.data.notificationsCreated, 1);
    const connectNotice = (await getFeed(cookieB)).notifications.find(item => item.kind === 'connections' && item.message.includes('community chat'));
    assert(connectNotice);
    assert.equal(connectNotice.href, '/#connect');

    const stickySave = await request('/api/curator/sticky-notes', {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { books: 'A new note about books.', films: 'Film desk note changed.', discussions: 'Conversation note.', community: 'Circle note.' }
    });
    assert.equal(stickySave.response.status, 200);
    assert.equal(stickySave.data.notificationsCreated, 1);
    assert((await getFeed(cookieB)).notifications.some(item => item.kind === 'desk' && item.message.includes('film notes')));

    const planeOn = await request('/api/curator/features', {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { paper_plane_enabled: true }
    });
    assert.equal(planeOn.response.status, 200);
    assert.equal(planeOn.data.notificationsCreated, 1);
    const planeOff = await request('/api/curator/features', {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { paper_plane_enabled: false }
    });
    assert.equal(planeOff.response.status, 200);
    assert.equal(planeOff.data.notificationsCreated, 1);
    const featureNotices = (await getFeed(cookieB)).notifications.filter(item => item.kind === 'feature');
    assert(featureNotices.some(item => item.title === 'The Paper Plane is open'));
    assert(featureNotices.some(item => item.title === 'The Paper Plane is resting'));

    const profileUpdate = await request(`/api/curator/members/${memberA.memberId}`, {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { bio: 'A refreshed member portrait biography.' }
    });
    assert.equal(profileUpdate.response.status, 200, profileUpdate.text);
    assert.equal(profileUpdate.data.notificationsCreated, 1);
    assert((await getFeed(cookieB)).notifications.some(item => item.kind === 'community' && item.message.includes('profile description')));

    const suspendMember = await request(`/api/curator/members/${memberB.memberId}/status`, {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { status: 'suspended' }
    });
    assert.equal(suspendMember.response.status, 200);
    assert.equal(suspendMember.data.notificationsCreated, 1);
    assert([401, 403].includes((await request('/api/member/notifications', { headers: { Cookie: cookieB } })).response.status), 'Suspension immediately revokes the member feed session.');
    assert((await getFeed(cookieA)).notifications.some(item => item.kind === 'community' && item.message.includes('no longer listed')));

    const reactivateMember = await request(`/api/curator/members/${memberB.memberId}/status`, {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { status: 'active' }
    });
    assert.equal(reactivateMember.response.status, 200);
    assert.equal(reactivateMember.data.notificationsCreated, 1);
    cookieB = await accessMember(memberB.secretCode);
    assert((await getFeed(cookieB)).notifications.some(item => item.kind === 'community' && item.message.includes('active in the circle again')));

    const invalidSave = await request('/api/curator/updates', {
        method: 'POST', headers: { Cookie: curatorCookie }, body: { title: '', content: 'This save must fail.' }
    });
    assert.equal(invalidSave.response.status, 400);
    assert(!(await getFeed(cookieB)).notifications.some(item => item.message.includes('This save must fail.')));

    const bulletinUpdate = await request(`/api/curator/updates/${bulletinId}`, {
        method: 'PUT', headers: { Cookie: curatorCookie }, body: { title: 'Admin preview bulletin revised', content: 'The saved bulletin now has updated details.' }
    });
    assert.equal(bulletinUpdate.response.status, 200, bulletinUpdate.text);
    assert.equal(bulletinUpdate.data.notificationsCreated, 1);
    assert((await getFeed(cookieB)).notifications.some(item => item.kind === 'bulletin' && item.message.includes('Admin preview bulletin revised')));
    const bulletinDelete = await request(`/api/curator/updates/${bulletinId}`, {
        method: 'DELETE', headers: { Cookie: curatorCookie }
    });
    assert.equal(bulletinDelete.response.status, 200, bulletinDelete.text);
    assert.equal(bulletinDelete.data.notificationsCreated, 1);
    assert((await getFeed(cookieB)).notifications.some(item => item.title === 'An announcement was removed'));

    // Wabi Wall was previously wired to a redirect/unmounted API. Verify curator save, validation, and member notification.
    const unauthenticatedNoticeWrite = await request('/api/notices', {
        method: 'POST', body: { title: 'Should be denied', content: 'No curator session.' }
    });
    assert.equal(unauthenticatedNoticeWrite.response.status, 401);
    const wallTitle = 'Wabi Wall management regression card';
    const createdNotice = await request('/api/notices', {
        method: 'POST',
        headers: { Cookie: curatorCookie },
        body: { title: wallTitle, content: 'A managed board card.', type: 'announcement', position_x: 220, position_y: 140 }
    });
    assert.equal(createdNotice.response.status, 201, createdNotice.text);
    assert.equal(createdNotice.data.notificationsCreated, 1);
    const noticeId = createdNotice.data.noticeId;
    const activeNotices = await request('/api/notices');
    const activeNotice = activeNotices.data.notices.find(item => item.id === noticeId && item.title === wallTitle);
    assert(activeNotice);
    assert.equal(activeNotice.created_by, undefined, 'Public Wabi Wall data must not expose internal curator identifiers.');

    const wallNotification = (await getFeed(cookieB)).notifications.find(item => item.kind === 'wabi_wall' && item.message.includes(wallTitle));
    assert(wallNotification);
    assert.equal(wallNotification.href, '/wabi-wall');
    const invalidNotice = await request('/api/notices', {
        method: 'POST',
        headers: { Cookie: curatorCookie },
        body: { title: 'Bad card', content: 'No unsafe type.', type: 'script onerror=alert(1)' }
    });
    assert.equal(invalidNotice.response.status, 400, 'Wabi Wall card types are allow-listed server-side.');
    const invalidNoticePosition = await request('/api/notices', {
        method: 'POST',
        headers: { Cookie: curatorCookie },
        body: { title: 'Invalid coordinate card', content: 'Blank values are not coordinates.', position_x: '' }
    });
    assert.equal(invalidNoticePosition.response.status, 400, 'Blank or non-numeric coordinates are rejected.');
    assert(!(await getFeed(cookieB)).notifications.some(item => item.message.includes('Invalid coordinate card')));

    const positionSave = await request(`/api/notices/${noticeId}/position`, {
        method: 'PATCH',
        headers: { Cookie: curatorCookie },
        body: { position_x: 260, position_y: 160, rotation: 1 }
    });
    assert.equal(positionSave.response.status, 200);
    assert.equal(positionSave.data.notificationsCreated, undefined, 'Dragging a card does not broadcast a content alert.');
    assert(!(await getFeed(cookieB)).notifications.some(item => item.title === 'Wabi Wall notice was updated' && item.message.includes(wallTitle)));

    const noticeEdit = await request(`/api/notices/${noticeId}`, {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { title: 'Wabi Wall notice refreshed', content: 'Updated from the curator board.' }
    });
    assert.equal(noticeEdit.response.status, 200, noticeEdit.text);
    assert.equal(noticeEdit.data.notificationsCreated, 1);
    assert((await getFeed(cookieB)).notifications.some(item => item.kind === 'wabi_wall' && item.message.includes('Wabi Wall notice refreshed')));
    const noticeNoOp = await request(`/api/notices/${noticeId}`, {
        method: 'PUT',
        headers: { Cookie: curatorCookie },
        body: { title: 'Wabi Wall notice refreshed', content: 'Updated from the curator board.' }
    });
    assert.equal(noticeNoOp.response.status, 200);
    assert.equal(noticeNoOp.data.notificationsCreated, 0, 'An unchanged Wabi Wall save must not re-notify the circle.');

    const archived = await request(`/api/notices/${noticeId}/archive`, {
        method: 'POST', headers: { Cookie: curatorCookie }
    });
    assert.equal(archived.response.status, 200, archived.text);
    assert.equal(archived.data.notificationsCreated, 1);
    assert(!(await request('/api/notices')).data.notices.some(item => item.id === noticeId));

    // Every independent member destination exposes the shared notification widget.
    for (const page of ['community', 'reader', 'table-room', 'wabi-wall', 'my-space']) {
        const html = fs.readFileSync(path.join(__dirname, '..', 'pages', `${page}.html`), 'utf8');
        assert(html.includes('memberNotificationRoot'), `${page} must provide the shared notification mount point.`);
        assert(html.includes('member-notifications.js'), `${page} must load the shared notification client.`);
    }
    const notificationClient = fs.readFileSync(path.join(__dirname, '..', 'js', 'member-notifications.js'), 'utf8');
    const notificationStyles = fs.readFileSync(path.join(__dirname, '..', 'css', 'member-notifications.css'), 'utf8');
    assert(notificationClient.includes("document.createElement(readOnlyPreview ? 'article' : 'button')"));
    assert(notificationStyles.includes('.member-notification-item:not(button)'));

    const mySpace = fs.readFileSync(path.join(__dirname, '..', 'pages', 'my-space.html'), 'utf8');
    assert(mySpace.includes('READ-ONLY CURATOR PREVIEW'));
    assert(mySpace.includes('if (isCuratorReadOnlyPreview) return;'));
    assert(mySpace.includes('deskConnectionError'), 'Member-service failures must not masquerade as an access-code failure.');
    assert(mySpace.includes('Check your connection and try again.'));

    // Cleanup through the same management endpoint under test; the remaining member gets the roster update.
    const removeMemberA = await request(`/api/curator/members/${memberA.memberId}`, {
        method: 'DELETE', headers: { Cookie: curatorCookie }
    });
    assert.equal(removeMemberA.response.status, 200, removeMemberA.text);
    assert.equal(removeMemberA.data.notificationsCreated, 1);
    assert((await getFeed(cookieB)).notifications.some(item => item.kind === 'community' && item.message.includes('Notification Test Mira is no longer listed')));
    const removeMemberB = await request(`/api/curator/members/${memberB.memberId}`, {
        method: 'DELETE', headers: { Cookie: curatorCookie }
    });
    assert.equal(removeMemberB.response.status, 200, removeMemberB.text);
    assert.equal(removeMemberB.data.notificationsCreated, 1);

    console.log('✓ Member broadcasts are durable, recipient-scoped, change-specific, and read-state-isolated.');
    console.log('✓ Curator preview is read-only; member shelves reflect stored data.');
    console.log('✓ Wabi Wall loads and saves through an active, validated curator API.');
    console.log('✓ All four independent member spaces and My Space expose the shared notification center.');
}

run().catch(error => {
    console.error('Admin experience regression checks failed:', error);
    process.exit(1);
});

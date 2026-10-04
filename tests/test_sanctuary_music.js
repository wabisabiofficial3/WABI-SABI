/**
 * WABI SABI — SANCTUARY MUSIC & AUDIO CONTROLS TEST SUITE
 * Validates:
 * 1. Default state of music_enabled is strictly false
 * 2. Portal endpoint exposes music_enabled and music_track
 * 3. Base64 audio upload via /api/curator/upload-music (creates audio file, updates settings)
 * 4. Volume slider update & feature toggle via /api/curator/features
 * 5. Track deletion via DELETE /api/curator/upload-music (removes file, resets settings)
 * 6. UI elements present in pages/curator.html and pages/home.html
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function request(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('--- Testing Sanctuary Music & Feature Controls ---');

    // 1. Login as Curator
    const loginRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'wabisabiofficial3@gmail.com', password: 'DsL@678_' });

    assert.strictEqual(loginRes.statusCode, 200, 'Login should succeed');
    const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
    assert.ok(cookie, 'Should have received curator session cookie');
    console.log('✓ Curator authenticated successfully');

    // Reset music track to clean default state
    await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/curator/upload-music',
        method: 'DELETE',
        headers: { 'Cookie': cookie }
    });

    // 2. Check /api/portal default feature state
    const portalRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/portal',
        method: 'GET'
    });
    assert.strictEqual(portalRes.statusCode, 200, 'Portal should respond 200');
    const features = portalRes.body.portal ? portalRes.body.portal.features : portalRes.body.features;
    assert.ok(features, 'Portal should expose features object');
    assert.strictEqual(features.music_enabled, false, 'music_enabled must be false by default');
    assert.strictEqual(features.cat_enabled, false, 'cat_enabled must be false by default');
    assert.strictEqual(features.paper_plane_enabled, false, 'paper_plane_enabled must be false by default');
    console.log('✓ Default feature toggles are all strictly OFF (music, cat, plane)');

    // 3. Upload a sample audio track
    // Dummy audio MP3 base64 header (ID3v2)
    const dummyAudioBase64 = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAFAAAACAA=';
    const uploadRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/curator/upload-music',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        }
    }, {
        audio_data: dummyAudioBase64,
        filename: 'ambient_wind_chimes.mp3',
        title: 'Ambient Wind Chimes',
        enable_now: true
    });

    assert.strictEqual(uploadRes.statusCode, 200, 'Upload music should respond 200');
    assert.ok(uploadRes.body.success, 'Upload response must be success');
    assert.ok(uploadRes.body.track.url, 'Track URL must be returned');
    assert.strictEqual(uploadRes.body.track.title, 'Ambient Wind Chimes');
    console.log('✓ Local MP3 audio uploaded successfully to assets/audio/');

    // 4. Verify physical file created on disk
    const audioPath = path.join(__dirname, '..', uploadRes.body.track.url.replace(/^\//, ''));
    assert.ok(fs.existsSync(audioPath), `Physical audio file should exist at ${audioPath}`);
    console.log('✓ Physical audio file verified on disk:', audioPath);

    // 5. Verify /api/portal reflects enabled music track
    const portalAfterUpload = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/portal',
        method: 'GET'
    });
    const updatedFeatures = portalAfterUpload.body.portal ? portalAfterUpload.body.portal.features : portalAfterUpload.body.features;
    assert.strictEqual(updatedFeatures.music_enabled, true, 'music_enabled should be true after enable_now');
    assert.strictEqual(updatedFeatures.music_track.title, 'Ambient Wind Chimes');
    console.log('✓ Portal successfully reflects enabled ambient soundtrack');

    // 6. Test volume adjustment
    const volRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/curator/features',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        }
    }, {
        music_track: { volume: 0.6 }
    });
    assert.strictEqual(volRes.statusCode, 200, 'Updating volume should respond 200');
    assert.strictEqual(volRes.body.features.music_track.volume, 0.6);
    console.log('✓ Music volume successfully adjusted via curator API');

    // 7. Delete audio track and reset to default OFF
    const deleteRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/curator/upload-music',
        method: 'DELETE',
        headers: { 'Cookie': cookie }
    });
    assert.strictEqual(deleteRes.statusCode, 200, 'Deleting audio track should respond 200');
    assert.ok(deleteRes.body.success, 'Deletion should report success');
    assert.ok(!fs.existsSync(audioPath), 'Physical audio file must be deleted from disk');
    console.log('✓ Physical audio file successfully removed from disk');

    // 8. Verify reset in portal features
    const portalAfterDelete = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/portal',
        method: 'GET'
    });
    const resetFeatures = portalAfterDelete.body.portal ? portalAfterDelete.body.portal.features : portalAfterDelete.body.features;
    assert.strictEqual(resetFeatures.music_enabled, false, 'music_enabled must return to false after delete');
    assert.strictEqual(resetFeatures.music_track.url, '', 'music_track.url must be blank');
    console.log('✓ Portal reset to default OFF state cleanly');

    // 9. Verify HTML markup and SVG presence
    const curatorHtml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'curator.html'), 'utf8');
    assert.ok(curatorHtml.includes('id="musicToggleCheckbox"'), 'curator.html must have music toggle');
    assert.ok(curatorHtml.includes('id="musicDropZone"'), 'curator.html must have drag & drop zone');
    assert.ok(curatorHtml.includes('id="curatorAudioPreview"'), 'curator.html must have audio preview player');
    assert.ok(curatorHtml.includes('id="catToggleCheckbox"'), 'curator.html must have cat toggle');
    assert.ok(curatorHtml.includes('id="paperPlaneToggleCheckbox"'), 'curator.html must have paper plane toggle');

    const homeHtml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'home.html'), 'utf8');
    assert.ok(homeHtml.includes('id="sanctuaryAmbientAudio"'), 'home.html must have sanctuary ambient audio');
    assert.ok(homeHtml.includes('id="portalMusicBtn"'), 'home.html must have portal ambient music button');
    assert.ok(homeHtml.includes('initSanctuaryMusic'), 'home.html must call initSanctuaryMusic');

    console.log('✓ All HTML markup, IDs, and client integration verified');
    console.log('✅ ALL SANCTUARY MUSIC TESTS PASSED CLEANLY!\n');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

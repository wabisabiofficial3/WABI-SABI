const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const {
    createUpdate,
    updateUpdate,
    deleteUpdate,
    getPublicUpdates,
    getSetting,
    getAllSettings,
    setSetting,
    getAllMembers,
    getAllMembersCurator,
    getMemberById,
    createMember,
    updateMember,
    regenerateMemberCode,
    setMemberStatus,
    createMemberClaim,
    deleteMember,
    getCuratorById,
    getCuratorWithPassword,
    updateCuratorProfile
} = require('../db');
const { hashPassword, verifyPassword } = require('../crypto');
const { requireCurator } = require('../middleware/auth');

// All curator routes require authentication
router.use(requireCurator);

/**
 * GET /api/curator/overview
 * Returns dashboard summary for the curator across the 3 pillars
 */
router.get('/overview', (req, res) => {
    try {
        const updates = getPublicUpdates();
        const settings = getAllSettings();
        const members = getAllMembersCurator();

        return res.json({
            success: true,
            curator: req.curator,
            announcements: {
                weekly_theme: settings.weekly_theme || { theme: '', subtitle: '' },
                this_weeks_reading: settings.this_weeks_reading || settings.current_book || {},
                gathering: settings.gathering || settings.next_meeting || {},
                discussion_points: settings.discussion_points || [],
                important_notes: settings.important_notes || '',
                bulletins: updates
            },
            community: {
                members
            },
            connect: {
                links: settings.connect_links || settings.platform_links || {}
            },
            members,
            updates,
            settings
        });
    } catch (err) {
        console.error('Error fetching curator overview:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch curator overview.' });
    }
});

/**
 * PUT /api/curator/announcements
 * Update Weekly Theme, This Week's Reading, Gathering, Discussion Points, and Important Notes
 */
router.put('/announcements', (req, res) => {
    try {
        const { weekly_theme, this_weeks_reading, gathering, discussion_points, important_notes } = req.body || {};

        if (weekly_theme !== undefined) {
            setSetting('weekly_theme', weekly_theme);
        }

        if (this_weeks_reading !== undefined) {
            setSetting('this_weeks_reading', this_weeks_reading);
            // Sync with current_book for backward-compatibility
            setSetting('current_book', this_weeks_reading);
        }

        if (gathering !== undefined) {
            setSetting('gathering', gathering);
            // Sync with next_meeting
            setSetting('next_meeting', gathering);
        }

        if (discussion_points !== undefined) {
            // Can be array or string with newlines
            let pts = discussion_points;
            if (typeof pts === 'string') {
                pts = pts.split('\n').map(s => s.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
            }
            setSetting('discussion_points', pts);
        }

        if (important_notes !== undefined) {
            setSetting('important_notes', important_notes);
        }

        return res.json({
            success: true,
            message: 'Announcements updated successfully.',
            settings: getAllSettings()
        });
    } catch (err) {
        console.error('Error updating announcements:', err);
        return res.status(500).json({ success: false, error: 'Failed to update announcements.' });
    }
});

/**
 * Community Members Directory Endpoints
 */
router.get('/members', (req, res) => {
    try {
        const members = getAllMembersCurator();
        return res.json({ success: true, members });
    } catch (err) {
        console.error('Error fetching members:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch members.' });
    }
});

router.post('/members', (req, res) => {
    try {
        const { name, full_name, display_name, role, handle, gender, date_joined, avatar_url, bio, display_order, status } = req.body || {};
        const memberName = (full_name || display_name || name || '').trim();
        if (!memberName) {
            return res.status(400).json({ success: false, error: 'Member name is required.' });
        }

        const result = createMember({
            name: memberName,
            full_name: (full_name || memberName).trim(),
            display_name: (display_name || memberName).trim(),
            role: role || 'Member',
            handle: handle || '',
            gender: gender || '',
            date_joined: date_joined || '',
            avatar_url: avatar_url || '../assets/user_avatar.jpg',
            bio: bio || '',
            display_order: display_order || 0,
            status: status || 'active'
        });

        return res.status(201).json({
            success: true,
            message: 'Member registered into circle.',
            memberId: result.id,
            secretCode: result.secretCode,
            member: result.member,
            members: getAllMembersCurator()
        });
    } catch (err) {
        console.error('Error creating member:', err);
        return res.status(500).json({ success: false, error: 'Failed to add member.' });
    }
});

router.put('/members/:id', (req, res) => {
    try {
        const { name, full_name, display_name, role, handle, gender, date_joined, avatar_url, bio, display_order, status } = req.body || {};
        updateMember(req.params.id, { name, full_name, display_name, role, handle, gender, date_joined, avatar_url, bio, display_order, status });
        return res.json({
            success: true,
            message: 'Member portrait updated.',
            member: getMemberById(req.params.id),
            members: getAllMembersCurator()
        });
    } catch (err) {
        console.error('Error updating member:', err);
        return res.status(500).json({ success: false, error: 'Failed to update member.' });
    }
});

router.post('/members/:id/regenerate-code', (req, res) => {
    try {
        const newCode = regenerateMemberCode(req.params.id);
        return res.json({
            success: true,
            message: 'New Secret Code generated. Previous code has been invalidated.',
            secretCode: newCode
        });
    } catch (err) {
        console.error('Error regenerating secret code:', err);
        return res.status(500).json({ success: false, error: 'Failed to regenerate code.' });
    }
});

router.put('/members/:id/status', (req, res) => {
    try {
        const { status } = req.body || {};
        if (!status || (status !== 'active' && status !== 'suspended')) {
            return res.status(400).json({ success: false, error: 'Valid status (active or suspended) is required.' });
        }
        setMemberStatus(req.params.id, status);
        return res.json({
            success: true,
            message: `Membership status updated to ${status}.`,
            status,
            members: getAllMembersCurator()
        });
    } catch (err) {
        console.error('Error setting member status:', err);
        return res.status(500).json({ success: false, error: 'Failed to update member status.' });
    }
});

router.post('/members/:id/generate-qr', async (req, res) => {
    try {
        const member = getMemberById(req.params.id);
        if (!member) {
            return res.status(404).json({ success: false, error: 'Member not found.' });
        }

        const token = createMemberClaim(req.params.id, 7);
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const claimUrl = `${protocol}://${host}/api/member/claim-pass?token=${token}`;

        let qrDataUrl = '';
        try {
            qrDataUrl = await QRCode.toDataURL(claimUrl, {
                margin: 2,
                width: 240,
                color: {
                    dark: '#273B2B',
                    light: '#FAF7F2'
                }
            });
        } catch (qrErr) {
            console.warn('QRCode generation fallback:', qrErr);
        }

        return res.json({
            success: true,
            token,
            claimUrl,
            qrDataUrl,
            member: {
                id: member.id,
                name: member.display_name || member.name,
                full_name: member.full_name || member.name,
                handle: member.handle,
                role: member.role || 'Member',
                date_joined: member.date_joined || 'Autumn 2026'
            }
        });
    } catch (err) {
        console.error('Error generating QR pass:', err);
        return res.status(500).json({ success: false, error: 'Failed to generate QR pass.' });
    }
});

router.delete('/members/:id', (req, res) => {
    try {
        deleteMember(req.params.id);
        return res.json({
            success: true,
            message: 'Member removed from directory.',
            members: getAllMembersCurator()
        });
    } catch (err) {
        console.error('Error deleting member:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete member.' });
    }
});

/**
 * PUT /api/curator/connect & PUT /api/curator/buttons
 * Update external platform links and button configuration
 */
router.put(['/connect', '/buttons'], (req, res) => {
    try {
        const links = req.body || {};
        const cleanLinks = {
            community_chat_url: links.community_chat_url || '',
            community_chat_label: links.community_chat_label || 'Join Community Lounge',
            book_drive_url: links.book_drive_url || '',
            book_drive_label: links.book_drive_label || 'Open Book Drive',
            meeting_maps_url: links.meeting_maps_url || '',
            meeting_maps_label: links.meeting_maps_label || 'Open in Google Maps',
            instagram_url: links.instagram_url || '',
            instagram_label: links.instagram_label || 'Instagram',
            whatsapp_url: links.whatsapp_url || '',
            whatsapp_label: links.whatsapp_label || 'WhatsApp Channel',
            discord_url: links.discord_url || '',
            discord_label: links.discord_label || 'Discord Lounge',
            goodreads_url: links.goodreads_url || '',
            goodreads_label: links.goodreads_label || 'Goodreads Circle',
            custom_btn_1_url: links.custom_btn_1_url || '',
            custom_btn_1_label: links.custom_btn_1_label || '',
            custom_btn_1_enabled: Boolean(links.custom_btn_1_enabled),
            custom_btn_2_url: links.custom_btn_2_url || '',
            custom_btn_2_label: links.custom_btn_2_label || '',
            custom_btn_2_enabled: Boolean(links.custom_btn_2_enabled)
        };

        setSetting('connect_links', cleanLinks);
        setSetting('button_links', cleanLinks);
        // Sync platform_links for backward-compatibility
        setSetting('platform_links', cleanLinks);

        return res.json({
            success: true,
            message: 'Button links and platform destinations updated.',
            links: cleanLinks,
            buttons: cleanLinks
        });
    } catch (err) {
        console.error('Error updating button links:', err);
        return res.status(500).json({ success: false, error: 'Failed to update button links.' });
    }
});

/**
 * PUT /api/curator/profile
 * Update Admin profile details (Display Name, Handle, Email, Password)
 */
router.put('/profile', async (req, res) => {
    try {
        const { displayName, handle, email, currentPassword, newPassword } = req.body || {};
        const curatorId = req.curator.id;

        const currentRecord = getCuratorWithPassword(curatorId);
        if (!currentRecord) {
            return res.status(404).json({ success: false, error: 'Curator profile not found.' });
        }

        let newPasswordHash = null;
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Please provide your current password to set a new password.'
                });
            }
            const isMatch = await verifyPassword(currentPassword, currentRecord.password_hash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'Current password does not match. Profile changes aborted.'
                });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be at least 6 characters long.'
                });
            }
            newPasswordHash = await hashPassword(newPassword);
        }

        const updated = updateCuratorProfile(curatorId, {
            displayName,
            handle,
            email,
            passwordHash: newPasswordHash
        });

        // Also update the seed record if it's admin-wabisabi
        try {
            const memberAdmin = db.prepare('SELECT id FROM members WHERE id = ?').get('mem-admin');
            if (memberAdmin && (displayName || handle)) {
                db.prepare(`
                    UPDATE members
                    SET name = ?, display_name = ?, full_name = ?, handle = ?
                    WHERE id = 'mem-admin'
                `).run(
                    updated.display_name,
                    updated.display_name,
                    updated.display_name,
                    `@${updated.handle.replace(/^@/, '')}`
                );
            }
        } catch (e) {}

        return res.json({
            success: true,
            message: 'Admin Profile updated successfully.',
            curator: {
                id: updated.id,
                email: updated.email,
                displayName: updated.display_name,
                handle: updated.handle
            }
        });
    } catch (err) {
        console.error('Error updating curator profile:', err);
        return res.status(500).json({ success: false, error: 'Failed to update admin profile.' });
    }
});

/**
 * POST /api/curator/updates
 * Publish a new announcement bulletin
 */
router.post('/updates', (req, res) => {
    try {
        const { title, content, type = 'announcement', is_pinned = 0 } = req.body || {};

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, error: 'Announcement title is required.' });
        }
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, error: 'Announcement content is required.' });
        }

        const id = createUpdate({
            title: title.trim(),
            content: content.trim(),
            type,
            is_pinned: Boolean(is_pinned),
            created_by: req.curator.id,
            author_name: req.curator.displayName
        });

        return res.status(201).json({
            success: true,
            message: 'Announcement published successfully.',
            updateId: id
        });
    } catch (err) {
        console.error('Error creating announcement:', err);
        return res.status(500).json({ success: false, error: 'Failed to publish announcement.' });
    }
});

/**
 * PUT /api/curator/updates/:id
 * Edit an existing announcement
 */
router.put('/updates/:id', (req, res) => {
    try {
        const { title, content, is_pinned } = req.body || {};
        updateUpdate(req.params.id, {
            title: title ? title.trim() : undefined,
            content: content ? content.trim() : undefined,
            is_pinned
        });

        return res.json({ success: true, message: 'Announcement updated.' });
    } catch (err) {
        console.error('Error updating announcement:', err);
        return res.status(500).json({ success: false, error: 'Failed to update announcement.' });
    }
});

/**
 * DELETE /api/curator/updates/:id
 * Delete an announcement
 */
router.delete('/updates/:id', (req, res) => {
    try {
        deleteUpdate(req.params.id);
        return res.json({ success: true, message: 'Announcement deleted.' });
    } catch (err) {
        console.error('Error deleting announcement:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete announcement.' });
    }
});

/**
 * GET /api/curator/settings
 * Fetch all platform settings
 */
router.get('/settings', (req, res) => {
    try {
        const settings = getAllSettings();
        return res.json({ success: true, settings });
    } catch (err) {
        console.error('Error fetching settings:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve settings.' });
    }
});

/**
 * PUT /api/curator/settings & PUT /api/curator/features
 * Platform settings & sanctuary feature toggles
 */
router.put(['/settings', '/features'], (req, res) => {
    try {
        const { current_book, next_meeting, platform_links, weekly_theme, this_weeks_reading, gathering, discussion_points, important_notes, connect_links, paper_plane_enabled, cat_enabled, music_enabled, music_track } = req.body || {};

        if (current_book !== undefined) setSetting('current_book', current_book);
        if (next_meeting !== undefined) setSetting('next_meeting', next_meeting);
        if (platform_links !== undefined) setSetting('platform_links', platform_links);
        if (weekly_theme !== undefined) setSetting('weekly_theme', weekly_theme);
        if (this_weeks_reading !== undefined) setSetting('this_weeks_reading', this_weeks_reading);
        if (gathering !== undefined) setSetting('gathering', gathering);
        if (discussion_points !== undefined) setSetting('discussion_points', discussion_points);
        if (important_notes !== undefined) setSetting('important_notes', important_notes);
        if (connect_links !== undefined) setSetting('connect_links', connect_links);
        if (paper_plane_enabled !== undefined) {
            setSetting('paper_plane_enabled', Boolean(paper_plane_enabled));
        }
        if (cat_enabled !== undefined) {
            setSetting('cat_enabled', Boolean(cat_enabled));
        }
        if (music_enabled !== undefined) {
            setSetting('music_enabled', Boolean(music_enabled));
        }
        if (music_track !== undefined) {
            const currentTrack = getSetting('music_track') || {};
            const mergedTrack = (typeof music_track === 'object' && music_track !== null) ? { ...currentTrack, ...music_track } : music_track;
            setSetting('music_track', mergedTrack);
        }
        if (req.body && req.body.sticky_notes !== undefined) setSetting('sticky_notes', req.body.sticky_notes);

        const allSettings = getAllSettings();
        return res.json({
            success: true,
            message: 'Portal settings and features updated successfully.',
            settings: allSettings,
            features: {
                paper_plane_enabled: Boolean(allSettings.paper_plane_enabled),
                cat_enabled: Boolean(allSettings.cat_enabled),
                music_enabled: Boolean(allSettings.music_enabled),
                music_track: allSettings.music_track
            }
        });
    } catch (err) {
        console.error('Error updating settings/features:', err);
        return res.status(500).json({ success: false, error: 'Failed to update settings.' });
    }
});

/**
 * POST /api/curator/upload-music
 * Upload or drop local MP3/audio track for ambient sanctuary soundtrack
 */
router.post('/upload-music', (req, res) => {
    try {
        const body = req.body || {};
        const filename = body.filename || 'ambient_track.mp3';
        const title = body.title || filename.replace(/\.[^/.]+$/, '');
        const dataBase64 = body.dataBase64 || body.audio_data || body.audioData;
        const volume = typeof body.volume === 'number' ? body.volume : 0.35;
        const loop = body.loop !== false;
        const enableNow = body.enableNow !== undefined ? body.enableNow : body.enable_now;

        if (!dataBase64) {
            return res.status(400).json({ success: false, error: 'No audio data received.' });
        }

        // Clean filename and ensure audio directory exists
        const cleanName = (filename || 'ambient_track.mp3').replace(/[^a-zA-Z0-9._-]/g, '_');
        const extMatch = cleanName.match(/\.(mp3|wav|ogg|m4a|aac)$/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
        const targetFilename = `ambient_track_${Date.now()}.${ext}`;

        const audioDir = path.join(__dirname, '..', '..', 'assets', 'audio');
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }

        // Remove base64 data URL header if present
        const base64Data = dataBase64.replace(/^data:audio\/[a-z0-9.-]+;base64,/, '').replace(/^data:application\/octet-stream;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        if (buffer.length > 50 * 1024 * 1024) {
            return res.status(400).json({ success: false, error: 'Audio file exceeds 50MB limit.' });
        }

        const filePath = path.join(audioDir, targetFilename);
        fs.writeFileSync(filePath, buffer);

        const trackData = {
            url: `/assets/audio/${targetFilename}`,
            title: title || filename || 'Sanctuary Ambient Track',
            filename: targetFilename,
            size: buffer.length,
            volume: typeof volume === 'number' ? volume : 0.35,
            loop: loop !== false,
            updated_at: new Date().toISOString()
        };

        setSetting('music_track', trackData);
        if (enableNow !== undefined) {
            setSetting('music_enabled', Boolean(enableNow));
        }

        return res.json({
            success: true,
            message: 'Ambient music track uploaded and saved successfully.',
            track: trackData,
            music_enabled: enableNow !== undefined ? Boolean(enableNow) : (getSetting('music_enabled') === true)
        });
    } catch (err) {
        console.error('Error uploading music track:', err);
        return res.status(500).json({ success: false, error: 'Failed to process audio track upload.' });
    }
});

/**
 * DELETE /api/curator/upload-music
 * Remove ambient music track
 */
router.delete('/upload-music', (req, res) => {
    try {
        const currentTrack = getSetting('music_track');
        if (currentTrack && currentTrack.filename) {
            const filePath = path.join(__dirname, '..', '..', 'assets', 'audio', currentTrack.filename);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) {}
            }
        }

        const emptyTrack = {
            url: '',
            title: 'No audio uploaded',
            filename: '',
            size: 0,
            volume: 0.35,
            loop: true
        };

        setSetting('music_track', emptyTrack);
        setSetting('music_enabled', false);

        return res.json({
            success: true,
            message: 'Ambient music track removed.',
            track: emptyTrack,
            music_enabled: false
        });
    } catch (err) {
        console.error('Error deleting music track:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete audio track.' });
    }
});

/**
 * PUT /api/curator/sticky-notes
 * Update one or all 4 tactile sticky notes on the reading desk
 */
router.put('/sticky-notes', (req, res) => {
    try {
        const existingNotes = getSetting('sticky_notes') || {
            books: '“Ideas that take quiet root, and stay with you for years.”',
            films: '“Quiet frames that open unexpected rooms in the mind.”',
            discussions: 'Conversations held with patience, without judgment.',
            community: '“Kindred souls who feel the quiet rhythm of life.”'
        };

        const incoming = req.body || {};
        const updatedNotes = {
            books: incoming.books !== undefined ? incoming.books : existingNotes.books,
            films: incoming.films !== undefined ? incoming.films : existingNotes.films,
            discussions: incoming.discussions !== undefined ? incoming.discussions : existingNotes.discussions,
            community: incoming.community !== undefined ? incoming.community : existingNotes.community
        };

        setSetting('sticky_notes', updatedNotes);

        return res.json({
            success: true,
            message: 'Sticky notes updated successfully.',
            sticky_notes: updatedNotes
        });
    } catch (err) {
        console.error('Error updating sticky notes:', err);
        return res.status(500).json({ success: false, error: 'Failed to update sticky notes.' });
    }
});

module.exports = router;

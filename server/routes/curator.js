const express = require('express');
const router = express.Router();
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
 * PUT /api/curator/settings
 * Backward compatibility settings update
 */
router.put('/settings', (req, res) => {
    try {
        const { current_book, next_meeting, platform_links, weekly_theme, this_weeks_reading, gathering, discussion_points, important_notes, connect_links } = req.body || {};

        if (current_book) setSetting('current_book', current_book);
        if (next_meeting) setSetting('next_meeting', next_meeting);
        if (platform_links) setSetting('platform_links', platform_links);
        if (weekly_theme) setSetting('weekly_theme', weekly_theme);
        if (this_weeks_reading) setSetting('this_weeks_reading', this_weeks_reading);
        if (gathering) setSetting('gathering', gathering);
        if (discussion_points) setSetting('discussion_points', discussion_points);
        if (important_notes) setSetting('important_notes', important_notes);
        if (connect_links) setSetting('connect_links', connect_links);
        if (req.body && req.body.sticky_notes) setSetting('sticky_notes', req.body.sticky_notes);

        return res.json({
            success: true,
            message: 'Portal settings updated successfully.',
            settings: getAllSettings()
        });
    } catch (err) {
        console.error('Error updating settings:', err);
        return res.status(500).json({ success: false, error: 'Failed to update settings.' });
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

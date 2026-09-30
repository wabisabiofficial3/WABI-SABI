const express = require('express');
const router = express.Router();
const {
    createUpdate,
    updateUpdate,
    deleteUpdate,
    getPublicUpdates,
    getSetting,
    getAllSettings,
    setSetting,
    getAllMembers,
    getMemberById,
    createMember,
    updateMember,
    deleteMember
} = require('../db');
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
        const members = getAllMembers();

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
        const members = getAllMembers();
        return res.json({ success: true, members });
    } catch (err) {
        console.error('Error fetching members:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch members.' });
    }
});

router.post('/members', (req, res) => {
    try {
        const { name, role, handle, avatar_url, bio, display_order } = req.body || {};
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Member name is required.' });
        }

        const id = createMember({
            name: name.trim(),
            role: role || 'Member',
            handle: handle || '',
            avatar_url: avatar_url || '../assets/user_avatar.jpg',
            bio: bio || '',
            display_order: display_order || 0
        });

        return res.status(201).json({
            success: true,
            message: 'Member added to community.',
            memberId: id,
            members: getAllMembers()
        });
    } catch (err) {
        console.error('Error creating member:', err);
        return res.status(500).json({ success: false, error: 'Failed to add member.' });
    }
});

router.put('/members/:id', (req, res) => {
    try {
        const { name, role, handle, avatar_url, bio, display_order } = req.body || {};
        updateMember(req.params.id, { name, role, handle, avatar_url, bio, display_order });
        return res.json({
            success: true,
            message: 'Member profile updated.',
            members: getAllMembers()
        });
    } catch (err) {
        console.error('Error updating member:', err);
        return res.status(500).json({ success: false, error: 'Failed to update member.' });
    }
});

router.delete('/members/:id', (req, res) => {
    try {
        deleteMember(req.params.id);
        return res.json({
            success: true,
            message: 'Member removed from directory.',
            members: getAllMembers()
        });
    } catch (err) {
        console.error('Error deleting member:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete member.' });
    }
});

/**
 * PUT /api/curator/connect
 * Update external platform links (Community Chat, Book Drive, Meeting Location, Socials)
 */
router.put('/connect', (req, res) => {
    try {
        const links = req.body || {};
        const cleanLinks = {
            community_chat_url: links.community_chat_url || '',
            book_drive_url: links.book_drive_url || '',
            meeting_maps_url: links.meeting_maps_url || '',
            instagram_url: links.instagram_url || '',
            whatsapp_url: links.whatsapp_url || '',
            discord_url: links.discord_url || ''
        };

        setSetting('connect_links', cleanLinks);
        // Sync platform_links for backward-compatibility
        setSetting('platform_links', cleanLinks);

        return res.json({
            success: true,
            message: 'Connect platform links updated.',
            links: cleanLinks
        });
    } catch (err) {
        console.error('Error updating connect links:', err);
        return res.status(500).json({ success: false, error: 'Failed to update connect links.' });
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

module.exports = router;

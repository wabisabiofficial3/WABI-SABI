const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const {
    db,
    withTransaction,
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
    clearInitialAdminPasswordFile,
    revokeOtherCuratorSessions,
    updateCuratorProfile
} = require('../db');
const { hashPassword, verifyPassword } = require('../crypto');
const { requireCurator } = require('../middleware/auth');

class RequestValidationError extends Error {
    constructor(message) {
        super(message);
        this.status = 400;
    }
}

function objectBody(value, field = 'Request body') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new RequestValidationError(`${field} must be an object.`);
    }
    return value;
}

function cleanString(value, field, maxLength, { optional = false } = {}) {
    if (value === undefined && optional) return undefined;
    if (typeof value !== 'string') throw new RequestValidationError(`${field} must be text.`);
    const clean = value.trim();
    if (clean.length > maxLength) throw new RequestValidationError(`${field} must be ${maxLength} characters or fewer.`);
    return clean;
}

function cleanHttpUrl(value, field, { optional = false } = {}) {
    const clean = cleanString(value, field, 2048, { optional });
    if (clean === undefined || clean === '') return clean;
    let parsed;
    try {
        parsed = new URL(clean);
    } catch (error) {
        throw new RequestValidationError(`${field} must be a valid http(s) URL.`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new RequestValidationError(`${field} must be a valid http(s) URL.`);
    }
    return parsed.href;
}

function cleanAvatarUrl(value) {
    if (value === undefined || value === null || value === '') return '/assets/user_avatar.jpg';
    const clean = cleanString(value, 'Avatar URL', 2048);
    const localPath = clean.replace(/^\.\.\//, '/');
    if (/^\/assets\/[A-Za-z0-9_./-]+$/.test(localPath) && !localPath.split('/').includes('..')) {
        return localPath;
    }
    return cleanHttpUrl(clean, 'Avatar URL');
}

function parseBoolean(value, field) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === 0) return Boolean(value);
    if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) return value.trim().toLowerCase() === 'true';
    throw new RequestValidationError(`${field} must be a boolean.`);
}

function cleanConnectLinks(input) {
    const links = objectBody(input, 'Links');
    const defaults = {
        community_chat_label: 'Join Community Lounge',
        book_drive_label: 'Open Book Drive',
        meeting_maps_label: 'Open in Google Maps',
        instagram_label: 'Instagram',
        whatsapp_label: 'WhatsApp Channel',
        discord_label: 'Discord Lounge',
        goodreads_label: 'Goodreads Circle',
        custom_btn_1_label: '',
        custom_btn_2_label: ''
    };
    const result = {};
    const urlKeys = [
        'community_chat_url', 'book_drive_url', 'meeting_maps_url', 'instagram_url',
        'whatsapp_url', 'discord_url', 'goodreads_url', 'custom_btn_1_url', 'custom_btn_2_url'
    ];
    for (const key of urlKeys) {
        result[key] = cleanHttpUrl(links[key] === undefined ? '' : links[key], key);
    }
    for (const [key, fallback] of Object.entries(defaults)) {
        result[key] = links[key] === undefined ? fallback : cleanString(links[key], key, 120);
    }
    for (const key of ['custom_btn_1_enabled', 'custom_btn_2_enabled']) {
        result[key] = links[key] === undefined ? false : parseBoolean(links[key], key);
    }
    return result;
}

function cleanMemberPayload(body, { partial = false } = {}) {
    const input = objectBody(body, 'Member data');
    const result = {};
    const fields = [
        ['name', 100], ['full_name', 100], ['display_name', 100], ['role', 40],
        ['handle', 50], ['gender', 50], ['date_joined', 80], ['bio', 1200]
    ];
    for (const [field, maxLength] of fields) {
        if (input[field] !== undefined) result[field] = cleanString(input[field], field, maxLength);
    }
    if (!partial) {
        const name = result.full_name || result.display_name || result.name || '';
        if (!name.trim()) throw new RequestValidationError('Member name is required.');
        result.name = name.trim();
        result.full_name = (result.full_name || name).trim();
        result.display_name = (result.display_name || name).trim();
        result.role = result.role || 'Member';
        result.handle = result.handle || '';
        result.gender = result.gender || '';
        result.date_joined = result.date_joined || '';
        result.bio = result.bio || '';
        result.status = input.status === undefined ? 'active' : input.status;
    } else if (input.status !== undefined) {
        result.status = input.status;
    }

    if (result.role !== undefined && !['Member', 'Curator', 'Reader', 'Admin'].includes(result.role)) {
        throw new RequestValidationError('Role must be Member, Curator, Reader or Admin.');
    }
    if (result.handle && !/^@[a-z0-9_.-]{2,32}$/i.test(result.handle)) {
        throw new RequestValidationError('Handle must start with @ and contain 2-32 letters, numbers, dots, underscores or hyphens.');
    }
    if (result.date_joined && /^\d{4}-\d{2}-\d{2}$/.test(result.date_joined)) {
        const date = new Date(`${result.date_joined}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result.date_joined) {
            throw new RequestValidationError('Date joined must be a real calendar date.');
        }
    }
    if (!partial || input.avatar_url !== undefined) result.avatar_url = cleanAvatarUrl(input.avatar_url);
    if (input.status !== undefined && !['active', 'suspended'].includes(input.status)) {
        throw new RequestValidationError('Status must be active or suspended.');
    }
    if (input.display_order !== undefined) {
        const order = Number(input.display_order);
        if (!Number.isInteger(order) || Math.abs(order) > 100000) {
            throw new RequestValidationError('Display order must be a whole number between -100000 and 100000.');
        }
        result.display_order = order;
    }
    return result;
}

function sendRouteError(res, error, fallback) {
    if (error.status === 400) return res.status(400).json({ success: false, error: error.message });
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ success: false, error: 'A record with those details already exists.' });
    console.error(fallback, error);
    return res.status(500).json({ success: false, error: fallback });
}

// Curator responses include member and account data and must never be cached.
router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});
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
        const body = objectBody(req.body);
        const settingUpdates = [];

        if (body.weekly_theme !== undefined) {
            const input = objectBody(body.weekly_theme, 'Weekly theme');
            const previous = getSetting('weekly_theme', {});
            const base = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
            settingUpdates.push(['weekly_theme', {
                theme: input.theme === undefined ? (base.theme || '') : cleanString(input.theme, 'Theme', 200),
                subtitle: input.subtitle === undefined
                    ? (base.subtitle || '')
                    : cleanString(input.subtitle, 'Theme subtitle', 1000)
            }]);
        }

        if (body.this_weeks_reading !== undefined) {
            const input = objectBody(body.this_weeks_reading, 'Reading selection');
            const previous = getSetting('this_weeks_reading', {});
            const base = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
            const reading = {
                title: input.title === undefined ? (base.title || '') : cleanString(input.title, 'Book title', 200),
                author: input.author === undefined ? (base.author || '') : cleanString(input.author, 'Book author', 200),
                notes: input.notes === undefined ? (base.notes || '') : cleanString(input.notes, 'Reading notes', 2000),
                drive_url: input.drive_url === undefined
                    ? (base.drive_url || '')
                    : cleanHttpUrl(input.drive_url, 'Book Drive URL')
            };
            settingUpdates.push(['this_weeks_reading', reading], ['current_book', reading]);
        }

        if (body.gathering !== undefined) {
            const input = objectBody(body.gathering, 'Gathering');
            const previous = getSetting('gathering', {});
            const base = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
            const gathering = {
                date: input.date === undefined ? (base.date || '') : cleanString(input.date, 'Gathering date', 120),
                time: input.time === undefined ? (base.time || '') : cleanString(input.time, 'Gathering time', 80),
                location: input.location === undefined ? (base.location || '') : cleanString(input.location, 'Gathering location', 300),
                maps_url: input.maps_url === undefined
                    ? (base.maps_url || '')
                    : cleanHttpUrl(input.maps_url, 'Map URL'),
                note: input.note === undefined ? (base.note || '') : cleanString(input.note, 'Gathering note', 1000)
            };
            settingUpdates.push(['gathering', gathering], ['next_meeting', gathering]);
        }

        if (body.discussion_points !== undefined) {
            let points = body.discussion_points;
            if (typeof points === 'string') {
                points = cleanString(points, 'Discussion points', 10000)
                    .split('\n')
                    .map(value => value.trim().replace(/^[-*•]\s*/, ''))
                    .filter(Boolean);
            }
            if (!Array.isArray(points) || points.length > 20) {
                throw new RequestValidationError('Discussion points must be an array of at most 20 items.');
            }
            settingUpdates.push(['discussion_points', points.map((point, index) => cleanString(point, `Discussion point ${index + 1}`, 500))]);
        }

        if (body.important_notes !== undefined) {
            settingUpdates.push(['important_notes', cleanString(body.important_notes, 'Important notes', 5000)]);
        }

        withTransaction(() => settingUpdates.forEach(([key, value]) => setSetting(key, value)));
        return res.json({
            success: true,
            message: 'Announcements updated successfully.',
            settings: getAllSettings()
        });
    } catch (err) {
        return sendRouteError(res, err, 'Failed to update announcements.');
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
        const member = cleanMemberPayload(req.body);
        const result = createMember(member);
        return res.status(201).json({
            success: true,
            message: 'Member registered into circle.',
            memberId: result.id,
            secretCode: result.secretCode,
            member: result.member,
            members: getAllMembersCurator()
        });
    } catch (err) {
        return sendRouteError(res, err, 'Failed to add member.');
    }
});

router.put('/members/:id', (req, res) => {
    try {
        const existing = getMemberById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, error: 'Member not found.' });
        const member = cleanMemberPayload(req.body, { partial: true });
        if (Object.keys(member).length === 0) {
            return res.status(400).json({ success: false, error: 'Provide at least one member field to update.' });
        }
        updateMember(req.params.id, member);
        return res.json({
            success: true,
            message: 'Member portrait updated.',
            member: getMemberById(req.params.id),
            members: getAllMembersCurator()
        });
    } catch (err) {
        return sendRouteError(res, err, 'Failed to update member.');
    }
});

router.post('/members/:id/regenerate-code', (req, res) => {
    try {
        if (!getMemberById(req.params.id)) return res.status(404).json({ success: false, error: 'Member not found.' });
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
        const member = getMemberById(req.params.id);
        if (!member) return res.status(404).json({ success: false, error: 'Member not found.' });
        const body = objectBody(req.body);
        const status = body.status;
        if (typeof status !== 'string' || !['active', 'suspended'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Valid status (active or suspended) is required.' });
        }
        if (member.id === 'mem-admin' && status === 'suspended') {
            return res.status(400).json({ success: false, error: 'The built-in admin directory entry cannot be suspended.' });
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
        if (!member) return res.status(404).json({ success: false, error: 'Member not found.' });
        if (member.status !== 'active') return res.status(409).json({ success: false, error: 'A QR pass cannot be created for a suspended member.' });
        if (process.env.NODE_ENV === 'production' && !process.env.APP_BASE_URL) {
            return res.status(503).json({ success: false, error: 'APP_BASE_URL must be configured before membership passes can be issued.' });
        }

        const baseValue = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
        let baseUrl;
        try {
            baseUrl = new URL(baseValue);
        } catch (error) {
            return res.status(503).json({ success: false, error: 'The configured application URL is invalid.' });
        }
        if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password ||
            (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:')) {
            return res.status(503).json({ success: false, error: 'APP_BASE_URL must be an https URL in production.' });
        }

        const token = createMemberClaim(req.params.id, 7);
        const claimUrl = new URL('/api/member/claim-pass', baseUrl.origin);
        claimUrl.searchParams.set('token', token);
        const claimUrlText = claimUrl.toString();
        const qrDataUrl = await QRCode.toDataURL(claimUrlText, {
            margin: 2,
            width: 240,
            color: { dark: '#273B2B', light: '#FAF7F2' }
        });

        return res.json({
            success: true,
            token,
            claimUrl: claimUrlText,
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
        return sendRouteError(res, err, 'Failed to generate QR pass.');
    }
});

router.delete('/members/:id', (req, res) => {
    try {
        const member = getMemberById(req.params.id);
        if (!member) return res.status(404).json({ success: false, error: 'Member not found.' });
        if (member.id === 'mem-admin') return res.status(400).json({ success: false, error: 'The built-in admin directory entry cannot be deleted.' });
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
        const cleanLinks = cleanConnectLinks(req.body);
        withTransaction(() => {
            setSetting('connect_links', cleanLinks);
            setSetting('button_links', cleanLinks);
            setSetting('platform_links', cleanLinks);
        });

        return res.json({
            success: true,
            message: 'Button links and platform destinations updated.',
            links: cleanLinks,
            buttons: cleanLinks
        });
    } catch (err) {
        return sendRouteError(res, err, 'Failed to update button links.');
    }
});

/**
 * PUT /api/curator/profile
 * Update Admin profile details (Display Name, Handle, Email, Password)
 */
router.put('/profile', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { displayName, handle, email, currentPassword } = body;
        const newPassword = body.newPassword;
        const curatorId = req.curator.id;

        if (displayName !== undefined && (typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 100)) {
            return res.status(400).json({ success: false, error: 'Display name must be 1-100 characters.' });
        }
        if (handle !== undefined && (typeof handle !== 'string' || !/^[a-z0-9_-]{3,32}$/i.test(handle.trim().replace(/^@/, '')))) {
            return res.status(400).json({ success: false, error: 'Handle must be 3-32 letters, numbers, underscores or hyphens.' });
        }
        if (email !== undefined && (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
            return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
        }
        if (currentPassword !== undefined && (typeof currentPassword !== 'string' || currentPassword.length > 1024)) {
            return res.status(400).json({ success: false, error: 'Current password is invalid.' });
        }
        if (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length > 1024)) {
            return res.status(400).json({ success: false, error: 'New password is invalid.' });
        }

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
            if (newPassword.length < 12) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be at least 12 characters long.'
                });
            }
            if (newPassword === currentPassword) {
                return res.status(400).json({ success: false, error: 'Choose a password different from your current password.' });
            }
            newPasswordHash = await hashPassword(newPassword);
        }

        const updated = updateCuratorProfile(curatorId, {
            displayName: typeof displayName === 'string' ? displayName.trim() : undefined,
            handle: typeof handle === 'string' ? handle.trim() : undefined,
            email: typeof email === 'string' ? email.trim() : undefined,
            passwordHash: newPasswordHash
        });
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Curator profile not found.' });
        }

        if (newPasswordHash) {
            // Keep the active session, but invalidate any other browser/device sessions.
            revokeOtherCuratorSessions(curatorId, req.curator.sessionId);
            try {
                clearInitialAdminPasswordFile();
            } catch (error) {
                console.warn('Could not remove one-time bootstrap password file:', error.message);
            }
        }

        const memberAdmin = db.prepare('SELECT id FROM members WHERE id = ?').get('mem-admin');
        if (memberAdmin) {
            db.prepare(`
                UPDATE members
                SET name = ?, display_name = ?, full_name = ?, handle = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = 'mem-admin'
            `).run(
                updated.display_name,
                updated.display_name,
                updated.display_name,
                `@${updated.handle.replace(/^@/, '')}`
            );
        }

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
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ success: false, error: 'That curator email or handle is already in use.' });
        }
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
        const body = objectBody(req.body);
        const title = cleanString(body.title, 'Announcement title', 200);
        const content = cleanString(body.content, 'Announcement content', 10000);
        const type = body.type === undefined ? 'announcement' : cleanString(body.type, 'Announcement type', 40);
        const isPinned = body.is_pinned === undefined ? false : parseBoolean(body.is_pinned, 'is_pinned');
        if (!title) throw new RequestValidationError('Announcement title is required.');
        if (!content) throw new RequestValidationError('Announcement content is required.');
        if (!/^[a-z0-9_-]+$/i.test(type)) throw new RequestValidationError('Announcement type contains unsupported characters.');

        const id = createUpdate({
            title,
            content,
            type,
            is_pinned: isPinned,
            created_by: req.curator.id,
            author_name: req.curator.displayName
        });

        return res.status(201).json({
            success: true,
            message: 'Announcement published successfully.',
            updateId: id
        });
    } catch (err) {
        return sendRouteError(res, err, 'Failed to publish announcement.');
    }
});

/**
 * PUT /api/curator/updates/:id
 * Edit an existing announcement
 */
router.put('/updates/:id', (req, res) => {
    try {
        const body = objectBody(req.body);
        const update = {};
        if (body.title !== undefined) {
            update.title = cleanString(body.title, 'Announcement title', 200);
            if (!update.title) throw new RequestValidationError('Announcement title cannot be empty.');
        }
        if (body.content !== undefined) update.content = cleanString(body.content, 'Announcement content', 10000);
        if (body.is_pinned !== undefined) update.is_pinned = parseBoolean(body.is_pinned, 'is_pinned');
        if (Object.keys(update).length === 0) throw new RequestValidationError('Provide at least one announcement field to update.');

        const changes = updateUpdate(req.params.id, update);
        if (!changes) return res.status(404).json({ success: false, error: 'Announcement not found.' });
        return res.json({ success: true, message: 'Announcement updated.' });
    } catch (err) {
        return sendRouteError(res, err, 'Failed to update announcement.');
    }
});

/**
 * DELETE /api/curator/updates/:id
 * Delete an announcement
 */
router.delete('/updates/:id', (req, res) => {
    try {
        if (!deleteUpdate(req.params.id)) return res.status(404).json({ success: false, error: 'Announcement not found.' });
        return res.json({ success: true, message: 'Announcement deleted.' });
    } catch (err) {
        return sendRouteError(res, err, 'Failed to delete announcement.');
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
        const body = objectBody(req.body);
        const updates = [];
        const readingInput = body.this_weeks_reading !== undefined ? body.this_weeks_reading : body.current_book;
        if (readingInput !== undefined) {
            const input = typeof readingInput === 'string' ? { title: readingInput } : objectBody(readingInput, 'Reading selection');
            const reading = {
                title: input.title === undefined ? '' : cleanString(input.title, 'Book title', 200),
                author: input.author === undefined ? '' : cleanString(input.author, 'Book author', 200),
                notes: input.notes === undefined ? '' : cleanString(input.notes, 'Reading notes', 2000),
                drive_url: input.drive_url === undefined ? '' : cleanHttpUrl(input.drive_url, 'Book Drive URL')
            };
            updates.push(['this_weeks_reading', reading], ['current_book', reading]);
        }

        const gatheringInput = body.gathering !== undefined ? body.gathering : body.next_meeting;
        if (gatheringInput !== undefined) {
            const input = objectBody(gatheringInput, 'Gathering');
            const gathering = {
                date: input.date === undefined ? '' : cleanString(input.date, 'Gathering date', 120),
                time: input.time === undefined ? '' : cleanString(input.time, 'Gathering time', 80),
                location: input.location === undefined ? '' : cleanString(input.location, 'Gathering location', 300),
                maps_url: input.maps_url === undefined ? '' : cleanHttpUrl(input.maps_url, 'Map URL'),
                note: input.note === undefined ? '' : cleanString(input.note, 'Gathering note', 1000)
            };
            updates.push(['gathering', gathering], ['next_meeting', gathering]);
        }

        if (body.weekly_theme !== undefined) {
            const input = objectBody(body.weekly_theme, 'Weekly theme');
            updates.push(['weekly_theme', {
                theme: input.theme === undefined ? '' : cleanString(input.theme, 'Theme', 200),
                subtitle: input.subtitle === undefined ? '' : cleanString(input.subtitle, 'Theme subtitle', 1000)
            }]);
        }
        if (body.discussion_points !== undefined) {
            const points = typeof body.discussion_points === 'string'
                ? cleanString(body.discussion_points, 'Discussion points', 10000).split('\n').map(value => value.trim()).filter(Boolean)
                : body.discussion_points;
            if (!Array.isArray(points) || points.length > 20) throw new RequestValidationError('Discussion points must be an array of at most 20 items.');
            updates.push(['discussion_points', points.map((point, index) => cleanString(point, `Discussion point ${index + 1}`, 500))]);
        }
        if (body.important_notes !== undefined) updates.push(['important_notes', cleanString(body.important_notes, 'Important notes', 5000)]);

        if (body.connect_links !== undefined || body.platform_links !== undefined) {
            const links = cleanConnectLinks(body.connect_links ?? body.platform_links);
            updates.push(['connect_links', links], ['platform_links', links], ['button_links', links]);
        }
        if (body.paper_plane_enabled !== undefined) {
            updates.push(['paper_plane_enabled', parseBoolean(body.paper_plane_enabled, 'paper_plane_enabled')]);
        }
        if (body.sticky_notes !== undefined) {
            const input = objectBody(body.sticky_notes, 'Sticky notes');
            const old = getSetting('sticky_notes', {});
            const previous = old && typeof old === 'object' && !Array.isArray(old) ? old : {};
            updates.push(['sticky_notes', {
                books: input.books === undefined ? (previous.books || '') : cleanString(input.books, 'Books note', 1000),
                films: input.films === undefined ? (previous.films || '') : cleanString(input.films, 'Films note', 1000),
                discussions: input.discussions === undefined ? (previous.discussions || '') : cleanString(input.discussions, 'Discussions note', 1000),
                community: input.community === undefined ? (previous.community || '') : cleanString(input.community, 'Community note', 1000)
            }]);
        }

        withTransaction(() => updates.forEach(([key, value]) => setSetting(key, value)));
        return res.json({
            success: true,
            message: 'Portal settings and features updated successfully.',
            settings: getAllSettings()
        });
    } catch (err) {
        return sendRouteError(res, err, 'Failed to update settings.');
    }
});

/**
 * PUT /api/curator/sticky-notes
 * Update one or all 4 tactile sticky notes on the reading desk
 */
router.put('/sticky-notes', (req, res) => {
    try {
        const incoming = objectBody(req.body, 'Sticky notes');
        const current = getSetting('sticky_notes') || {};
        const existingNotes = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
        const updatedNotes = {
            books: incoming.books === undefined ? (existingNotes.books || '') : cleanString(incoming.books, 'Books note', 1000),
            films: incoming.films === undefined ? (existingNotes.films || '') : cleanString(incoming.films, 'Films note', 1000),
            discussions: incoming.discussions === undefined ? (existingNotes.discussions || '') : cleanString(incoming.discussions, 'Discussions note', 1000),
            community: incoming.community === undefined ? (existingNotes.community || '') : cleanString(incoming.community, 'Community note', 1000)
        };

        setSetting('sticky_notes', updatedNotes);
        return res.json({
            success: true,
            message: 'Sticky notes updated successfully.',
            sticky_notes: updatedNotes
        });
    } catch (err) {
        return sendRouteError(res, err, 'Failed to update sticky notes.');
    }
});

module.exports = router;

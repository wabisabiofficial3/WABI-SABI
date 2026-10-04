const express = require('express');
const crypto = require('node:crypto');
const { db, withTransaction } = require('../db');
const { requireCurator } = require('../middleware/auth');
const { notifyMembersOfChange } = require('../memberNotifications');

const router = express.Router();
const NOTICE_TYPES = new Set([
    'theme_poster', 'about', 'films_list', 'timeline',
    'participation', 'discussion', 'curator_note', 'announcement'
]);
const PIN_COLORS = new Set(['brass', 'red', 'green', 'purple', 'bronze']);

class RequestValidationError extends Error {
    constructor(message) {
        super(message);
        this.status = 400;
    }
}

function objectBody(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new RequestValidationError('Notice data must be an object.');
    }
    return value;
}

function cleanText(value, field, maximum, { optional = false } = {}) {
    if (value === undefined && optional) return undefined;
    if (typeof value !== 'string') throw new RequestValidationError(`${field} must be text.`);
    const clean = value.trim();
    if (clean.length > maximum) throw new RequestValidationError(`${field} must be ${maximum} characters or fewer.`);
    return clean;
}

function numberInRange(value, field, minimum, maximum, { optional = false, integer = false } = {}) {
    if (value === undefined && optional) return undefined;
    if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && value.trim() === '')) {
        throw new RequestValidationError(`${field} must be a valid number.`);
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum || (integer && !Number.isInteger(number))) {
        const range = integer ? 'a whole number' : 'a number';
        throw new RequestValidationError(`${field} must be ${range} between ${minimum} and ${maximum}.`);
    }
    return number;
}

function parseBoolean(value, field) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === 0) return Boolean(value);
    if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) return value.trim().toLowerCase() === 'true';
    throw new RequestValidationError(`${field} must be a boolean.`);
}

function cleanImage(value, { optional = false } = {}) {
    if (value === undefined && optional) return undefined;
    if (value === undefined || value === null || value === '') return '';
    const clean = cleanText(value, 'Notice image', 2048);
    const localPath = clean.startsWith('/') ? clean : `/${clean.replace(/^(?:\.\.\/)+/, '')}`;
    if (/^\/assets\/[A-Za-z0-9_./-]+$/.test(localPath) && !localPath.split('/').includes('..')) {
        return localPath;
    }
    let parsed;
    try { parsed = new URL(clean); } catch (error) {
        throw new RequestValidationError('Notice image must be an /assets path or an https URL.');
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        throw new RequestValidationError('Notice image must be an /assets path or an https URL.');
    }
    return parsed.href;
}

function cleanMetadata(value, { optional = false } = {}) {
    if (value === undefined && optional) return undefined;
    if (value === undefined || value === null) return '{}';
    let metadata = value;
    if (typeof metadata === 'string') {
        if (metadata.length > 12000) throw new RequestValidationError('Notice metadata is too large.');
        try { metadata = JSON.parse(metadata); } catch (error) {
            throw new RequestValidationError('Notice metadata must be valid JSON.');
        }
    }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        throw new RequestValidationError('Notice metadata must be an object.');
    }
    const serialized = JSON.stringify(metadata);
    if (serialized.length > 12000) throw new RequestValidationError('Notice metadata is too large.');
    return serialized;
}

function cleanNoticePayload(value, { partial = false } = {}) {
    const body = objectBody(value);
    const notice = {};
    if (!partial || body.title !== undefined) {
        notice.title = cleanText(body.title, 'Notice title', 200);
        if (!notice.title) throw new RequestValidationError('Notice title is required.');
    }
    if (!partial || body.content !== undefined) {
        notice.content = body.content === undefined ? '' : cleanText(body.content, 'Notice content', 10000);
    }
    if (!partial || body.type !== undefined) {
        notice.type = body.type === undefined ? 'announcement' : cleanText(body.type, 'Notice type', 40);
        if (!NOTICE_TYPES.has(notice.type)) throw new RequestValidationError('Notice type is not supported.');
    }
    if (!partial || body.metadata !== undefined) notice.metadata = cleanMetadata(body.metadata, { optional: partial });
    if (!partial || body.image !== undefined) notice.image = cleanImage(body.image, { optional: partial });
    if (!partial || body.priority !== undefined) {
        notice.priority = body.priority === undefined ? 50 : numberInRange(body.priority, 'Priority', -100000, 100000, { integer: true });
    }
    if (!partial || body.position_x !== undefined) {
        notice.position_x = body.position_x === undefined ? 100 : numberInRange(body.position_x, 'Horizontal position', 0, 10000);
    }
    if (!partial || body.position_y !== undefined) {
        notice.position_y = body.position_y === undefined ? 100 : numberInRange(body.position_y, 'Vertical position', 0, 10000);
    }
    if (!partial || body.rotation !== undefined) {
        notice.rotation = body.rotation === undefined ? 0 : numberInRange(body.rotation, 'Rotation', -20, 20);
    }
    if (!partial || body.is_pinned !== undefined) {
        notice.is_pinned = body.is_pinned === undefined ? true : parseBoolean(body.is_pinned, 'Pinned state');
    }
    if (!partial || body.pin_color !== undefined) {
        notice.pin_color = body.pin_color === undefined ? 'brass' : cleanText(body.pin_color, 'Pin color', 20).toLowerCase();
        if (!PIN_COLORS.has(notice.pin_color)) throw new RequestValidationError('Pin color is not supported.');
    }
    return notice;
}

function validNoticeId(id) {
    return typeof id === 'string' && /^notice-[a-f0-9]{24}$/i.test(id);
}

function sendError(res, error, fallback) {
    if (error.status === 400) return res.status(400).json({ success: false, error: error.message });
    console.error(fallback, error);
    return res.status(500).json({ success: false, error: fallback });
}

router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

/** GET /api/notices — return active Wabi Wall cards. */
router.get('/', (req, res) => {
    try {
        const notices = db.prepare(`
            SELECT id, title, content, type, metadata, image, priority,
                   position_x, position_y, rotation, is_pinned, pin_color,
                   published_at, updated_at
            FROM theme_notices
            WHERE archived_at IS NULL
            ORDER BY priority ASC, published_at DESC, id DESC
        `).all().map(notice => {
            let metadata = {};
            try { metadata = JSON.parse(notice.metadata || '{}'); } catch (error) {}
            return { ...notice, metadata, is_pinned: Boolean(notice.is_pinned) };
        });
        return res.json({
            success: true,
            theme: {
                id: 'theme-solitude',
                title: 'Cinema of Solitude',
                vol: 'VOL. 1',
                period: 'SEPT 22 – OCT 20, 2026',
                motto: 'Not just books. A space to feel, think, and reflect.'
            },
            notices
        });
    } catch (err) {
        console.error('Error fetching Wabi Wall notices:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve notices.' });
    }
});

/** POST /api/notices — curator-only publication to Wabi Wall. */
router.post('/', requireCurator, (req, res) => {
    try {
        const notice = cleanNoticePayload(req.body);
        const id = `notice-${crypto.randomBytes(12).toString('hex')}`;
        withTransaction(() => {
            db.prepare(`
                INSERT INTO theme_notices (
                    id, title, content, type, metadata, image, priority,
                    position_x, position_y, rotation, is_pinned, pin_color,
                    created_by, published_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
                id,
                notice.title,
                notice.content,
                notice.type,
                notice.metadata,
                notice.image,
                notice.priority,
                notice.position_x,
                notice.position_y,
                notice.rotation,
                notice.is_pinned ? 1 : 0,
                notice.pin_color,
                req.curator.id
            );
            notifyMembersOfChange('wabi_wall_created', req.curator.id, { title: notice.title });
        });
        return res.status(201).json({ success: true, message: 'Notice pinned to Wabi Wall.', notificationsCreated: 1, noticeId: id });
    } catch (err) {
        return sendError(res, err, 'Failed to create notice.');
    }
});

/** PUT /api/notices/:id — curator-only content edit. */
router.put('/:id', requireCurator, (req, res) => {
    try {
        if (!validNoticeId(req.params.id)) return res.status(404).json({ success: false, error: 'Notice not found.' });
        const update = cleanNoticePayload(req.body, { partial: true });
        if (Object.keys(update).length === 0) {
            return res.status(400).json({ success: false, error: 'Provide at least one notice field to update.' });
        }
        const existing = db.prepare('SELECT id, title, content, type, metadata, image, priority, is_pinned, pin_color FROM theme_notices WHERE id = ? AND archived_at IS NULL').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, error: 'Notice not found.' });
        const changedFields = Object.entries(update).filter(([key, value]) => {
            if (key === 'is_pinned') return Boolean(value) !== Boolean(existing[key]);
            return value !== existing[key];
        });
        if (changedFields.length === 0) return res.json({ success: true, message: 'Notice is already up to date.', notificationsCreated: 0 });

        const assignments = changedFields.map(([key]) => `${key} = ?`).join(', ');
        const values = changedFields.map(([, value]) => keyValueForDatabase(value));
        withTransaction(() => {
            db.prepare(`UPDATE theme_notices SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, req.params.id);
            notifyMembersOfChange('wabi_wall_updated', req.curator.id, {
                title: update.title || existing.title
            });
        });
        return res.json({ success: true, message: 'Wabi Wall notice updated.', notificationsCreated: 1 });
    } catch (err) {
        return sendError(res, err, 'Failed to update notice.');
    }
});

function keyValueForDatabase(value) {
    return typeof value === 'boolean' ? (value ? 1 : 0) : value;
}

/** PATCH /api/notices/:id/position — layout-only save; no member broadcast. */
router.patch('/:id/position', requireCurator, (req, res) => {
    try {
        if (!validNoticeId(req.params.id)) return res.status(404).json({ success: false, error: 'Notice not found.' });
        const body = objectBody(req.body);
        const positionX = numberInRange(body.position_x, 'Horizontal position', 0, 10000);
        const positionY = numberInRange(body.position_y, 'Vertical position', 0, 10000);
        const rotation = body.rotation === undefined ? null : numberInRange(body.rotation, 'Rotation', -20, 20);
        const existing = db.prepare('SELECT id, position_x, position_y, rotation FROM theme_notices WHERE id = ? AND archived_at IS NULL').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, error: 'Notice not found.' });
        if (existing.position_x === positionX && existing.position_y === positionY && (rotation === null || existing.rotation === rotation)) {
            return res.json({ success: true, message: 'Notice position is already up to date.' });
        }
        db.prepare(`
            UPDATE theme_notices
            SET position_x = ?, position_y = ?, rotation = COALESCE(?, rotation), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(positionX, positionY, rotation, req.params.id);
        return res.json({ success: true, message: 'Notice position updated.' });
    } catch (err) {
        return sendError(res, err, 'Failed to update notice position.');
    }
});

/** PATCH /api/notices/:id/pin — change visibility prominence on the board. */
router.patch('/:id/pin', requireCurator, (req, res) => {
    try {
        if (!validNoticeId(req.params.id)) return res.status(404).json({ success: false, error: 'Notice not found.' });
        const existing = db.prepare('SELECT id, title, is_pinned FROM theme_notices WHERE id = ? AND archived_at IS NULL').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, error: 'Notice not found.' });
        const nextPinned = existing.is_pinned ? 0 : 1;
        withTransaction(() => {
            db.prepare('UPDATE theme_notices SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextPinned, req.params.id);
            notifyMembersOfChange('wabi_wall_updated', req.curator.id, { title: existing.title });
        });
        return res.json({ success: true, is_pinned: Boolean(nextPinned), notificationsCreated: 1 });
    } catch (err) {
        return sendError(res, err, 'Failed to update notice pin.');
    }
});

/** POST /api/notices/:id/archive — remove a notice from the active board. */
router.post('/:id/archive', requireCurator, (req, res) => {
    try {
        if (!validNoticeId(req.params.id)) return res.status(404).json({ success: false, error: 'Notice not found.' });
        const existing = db.prepare('SELECT id FROM theme_notices WHERE id = ? AND archived_at IS NULL').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, error: 'Notice not found.' });
        withTransaction(() => {
            db.prepare('UPDATE theme_notices SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
            notifyMembersOfChange('wabi_wall_removed', req.curator.id);
        });
        return res.json({ success: true, message: 'Notice archived from Wabi Wall.', notificationsCreated: 1 });
    } catch (err) {
        return sendError(res, err, 'Failed to archive notice.');
    }
});

/** DELETE /api/notices/:id — curator-only permanent deletion. */
router.delete('/:id', requireCurator, (req, res) => {
    try {
        if (!validNoticeId(req.params.id)) return res.status(404).json({ success: false, error: 'Notice not found.' });
        const existing = db.prepare('SELECT id FROM theme_notices WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, error: 'Notice not found.' });
        withTransaction(() => {
            db.prepare('DELETE FROM theme_notices WHERE id = ?').run(req.params.id);
            notifyMembersOfChange('wabi_wall_removed', req.curator.id);
        });
        return res.json({ success: true, message: 'Notice permanently deleted.', notificationsCreated: 1 });
    } catch (err) {
        return sendError(res, err, 'Failed to delete notice.');
    }
});

module.exports = router;

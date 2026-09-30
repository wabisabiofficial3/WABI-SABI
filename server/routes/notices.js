const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { db } = require('../db');
const { requireAuth, requireCurator } = require('../middleware/auth');

/**
 * GET /api/notices
 * Public endpoint: Retrieve all published, active (non-archived) notices on the board.
 * Anyone can view notices without logging in.
 */
router.get('/', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT id, title, content, type, metadata, image, priority,
                   position_x, position_y, rotation, is_pinned, pin_color,
                   published_at, created_by, updated_at
            FROM theme_notices
            WHERE archived_at IS NULL
            ORDER BY priority ASC, published_at DESC
        `);
        const notices = stmt.all();

        // Parse JSON metadata safely
        const formatted = notices.map(n => {
            let meta = {};
            if (n.metadata) {
                try {
                    meta = JSON.parse(n.metadata);
                } catch (e) {
                    meta = {};
                }
            }
            return {
                ...n,
                metadata: meta,
                is_pinned: Boolean(n.is_pinned)
            };
        });

        res.json({
            success: true,
            theme: {
                id: 'theme-solitude',
                title: 'Cinema of Solitude',
                vol: 'VOL. 1',
                period: 'SEPT 22 – OCT 20, 2026',
                motto: 'Not just books. A space to feel, think, and reflect.'
            },
            notices: formatted
        });
    } catch (err) {
        console.error('Error fetching theme notices:', err);
        res.status(500).json({ success: false, error: 'Failed to retrieve notices.' });
    }
});

/**
 * POST /api/notices
 * Curator-only: Create a new notice card on the digital notice board.
 */
router.post('/', requireAuth, requireCurator, (req, res) => {
    try {
        const {
            title,
            content,
            type = 'announcement',
            metadata = {},
            image = '',
            priority = 50,
            position_x = 100,
            position_y = 100,
            rotation = 0,
            is_pinned = 1,
            pin_color = 'brass'
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, error: 'Notice title is required.' });
        }

        const id = `notice-${crypto.randomBytes(6).toString('hex')}`;
        const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;

        const insertStmt = db.prepare(`
            INSERT INTO theme_notices (
                id, title, content, type, metadata, image, priority,
                position_x, position_y, rotation, is_pinned, pin_color,
                created_by, published_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);

        insertStmt.run(
            id,
            title.trim(),
            (content || '').trim(),
            type,
            metaStr,
            image,
            Number(priority) || 50,
            Number(position_x) || 100,
            Number(position_y) || 100,
            Number(rotation) || 0,
            is_pinned ? 1 : 0,
            pin_color,
            req.user.id
        );

        res.status(201).json({
            success: true,
            message: 'Notice pinned to board.',
            noticeId: id
        });
    } catch (err) {
        console.error('Error creating notice:', err);
        res.status(500).json({ success: false, error: 'Failed to create notice.' });
    }
});

/**
 * PUT /api/notices/:id
 * Curator-only: Edit an existing notice's title, content, type, and metadata.
 */
router.put('/:id', requireAuth, requireCurator, (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            content,
            type,
            metadata,
            image,
            priority,
            pin_color
        } = req.body;

        const existing = db.prepare('SELECT id FROM theme_notices WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Notice not found.' });
        }

        const metaStr = metadata ? (typeof metadata === 'object' ? JSON.stringify(metadata) : metadata) : null;

        const updateStmt = db.prepare(`
            UPDATE theme_notices
            SET title = COALESCE(?, title),
                content = COALESCE(?, content),
                type = COALESCE(?, type),
                metadata = COALESCE(?, metadata),
                image = COALESCE(?, image),
                priority = COALESCE(?, priority),
                pin_color = COALESCE(?, pin_color),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        updateStmt.run(
            title !== undefined ? title.trim() : null,
            content !== undefined ? content.trim() : null,
            type || null,
            metaStr,
            image !== undefined ? image : null,
            priority !== undefined ? Number(priority) : null,
            pin_color || null,
            id
        );

        res.json({ success: true, message: 'Notice updated.' });
    } catch (err) {
        console.error('Error updating notice:', err);
        res.status(500).json({ success: false, error: 'Failed to update notice.' });
    }
});

/**
 * PATCH /api/notices/:id/position
 * Curator-only: Update the notice's coordinates and rotation on the corkboard.
 */
router.patch('/:id/position', requireAuth, requireCurator, (req, res) => {
    try {
        const { id } = req.params;
        const { position_x, position_y, rotation } = req.body;

        const existing = db.prepare('SELECT id FROM theme_notices WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Notice not found.' });
        }

        const updateStmt = db.prepare(`
            UPDATE theme_notices
            SET position_x = ?,
                position_y = ?,
                rotation = COALESCE(?, rotation),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        updateStmt.run(
            Number(position_x),
            Number(position_y),
            rotation !== undefined ? Number(rotation) : null,
            id
        );

        res.json({ success: true, message: 'Notice position updated.' });
    } catch (err) {
        console.error('Error updating notice position:', err);
        res.status(500).json({ success: false, error: 'Failed to update position.' });
    }
});

/**
 * PATCH /api/notices/:id/pin
 * Curator-only: Toggle pinned status of a notice.
 */
router.patch('/:id/pin', requireAuth, requireCurator, (req, res) => {
    try {
        const { id } = req.params;
        const existing = db.prepare('SELECT is_pinned FROM theme_notices WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Notice not found.' });
        }

        const newPinned = existing.is_pinned ? 0 : 1;
        db.prepare('UPDATE theme_notices SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newPinned, id);

        res.json({ success: true, is_pinned: Boolean(newPinned) });
    } catch (err) {
        console.error('Error toggling pin:', err);
        res.status(500).json({ success: false, error: 'Failed to toggle pin state.' });
    }
});

/**
 * POST /api/notices/:id/archive
 * Curator-only: Soft-archive a notice from active community view.
 */
router.post('/:id/archive', requireAuth, requireCurator, (req, res) => {
    try {
        const { id } = req.params;
        const existing = db.prepare('SELECT id FROM theme_notices WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Notice not found.' });
        }

        db.prepare('UPDATE theme_notices SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(id);

        res.json({ success: true, message: 'Notice archived from board.' });
    } catch (err) {
        console.error('Error archiving notice:', err);
        res.status(500).json({ success: false, error: 'Failed to archive notice.' });
    }
});

/**
 * DELETE /api/notices/:id
 * Curator-only: Delete a notice permanently.
 */
router.delete('/:id', requireAuth, requireCurator, (req, res) => {
    try {
        const { id } = req.params;
        const existing = db.prepare('SELECT id FROM theme_notices WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Notice not found.' });
        }

        db.prepare('DELETE FROM theme_notices WHERE id = ?').run(id);

        res.json({ success: true, message: 'Notice permanently deleted.' });
    } catch (err) {
        console.error('Error deleting notice:', err);
        res.status(500).json({ success: false, error: 'Failed to delete notice.' });
    }
});

module.exports = router;

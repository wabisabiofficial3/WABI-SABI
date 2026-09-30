const express = require('express');
const { db } = require('../db');
const { requireAuth, requireCurator } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper to fetch and parse site_content key
 */
function getContentKey(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM site_content WHERE key = ?').get(key);
    if (!row) return defaultValue;
    try {
        return JSON.parse(row.value);
    } catch (e) {
        return row.value;
    }
}

/**
 * GET /api/content
 * Returns active site content (featured book, current salon, sticky prompts)
 */
router.get('/', (req, res) => {
    try {
        const featuredBook = getContentKey('featured_book', {
            id: 'book-atomic-habits',
            title: 'Atomic Habits',
            author: 'James Clear',
            quote: 'Small habits, quiet evenings, a brighter you.',
            cover: 'assets/atomic_habits_cover.jpg',
            readers: 1240,
            discussionDate: 'Oct 04, 2026',
            description: 'An easy & proven way to build good habits & break bad ones.'
        });

        const currentSalon = getContentKey('current_salon', {
            id: 'salon-cinema-solitude',
            title: 'Film & Literature Night',
            detail: 'Interstellar & Solitude • 7:00 PM • Live Lounge',
            month: 'Sep',
            day: '28',
            attendees: 324,
            host: 'Wabi Sabi Curators',
            status: 'UPCOMING'
        });

        const stickyPrompts = getContentKey('sticky_prompts', [
            { id: 'prompt-1', key: 'books', title: 'Reading Thoughts', text: 'What sentence stayed with you long after closing the book tonight?', color: 'cream' },
            { id: 'prompt-2', key: 'films', title: 'Cinema Notes', text: 'Which silent scene in Lost in Translation captured what words never could?', color: 'mint' },
            { id: 'prompt-3', key: 'discuss', title: 'Quiet Musings', text: 'Does solitude restore your spirit or challenge it?', color: 'lavender' },
            { id: 'prompt-4', key: 'community', title: 'Open Letter', text: 'Write one piece of reassurance to someone reading in the dark.', color: 'peach' }
        ]);

        res.json({
            success: true,
            content: {
                featuredBook,
                currentSalon,
                upcomingEvent: currentSalon, // backward compat with dashboard.js
                stickyPrompts,
                stickyTitles: {
                    books: stickyPrompts.find(p => p.key === 'books')?.title || 'Reading Thoughts',
                    films: stickyPrompts.find(p => p.key === 'films')?.title || 'Cinema Notes',
                    discuss: stickyPrompts.find(p => p.key === 'discuss')?.title || 'Quiet Musings',
                    community: stickyPrompts.find(p => p.key === 'community')?.title || 'Open Letter'
                }
            }
        });
    } catch (err) {
        console.error('GET /api/content error:', err);
        res.status(500).json({ success: false, error: 'Failed to retrieve site content.' });
    }
});

/**
 * PUT /api/content/featured-book
 * Curator-only: Updates the club's featured book of the month
 */
router.put('/featured-book', requireAuth, requireCurator, (req, res) => {
    try {
        const { title, author, quote, readers, cover, discussionDate, description } = req.body;
        if (!title || !author) {
            return res.status(400).json({ success: false, error: 'Title and author are required.' });
        }

        const existing = getContentKey('featured_book', {});
        const updatedBook = {
            ...existing,
            title: title.trim(),
            author: author.trim(),
            quote: (quote || existing.quote || '').trim(),
            readers: parseInt(readers, 10) || existing.readers || 1000,
            cover: cover || existing.cover || 'assets/atomic_habits_cover.jpg',
            discussionDate: discussionDate || existing.discussionDate || 'Upcoming',
            description: description || existing.description || ''
        };

        const upsertStmt = db.prepare(`
            INSERT INTO site_content (key, value, updated_by, updated_at)
            VALUES ('featured_book', ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_by = excluded.updated_by,
                updated_at = CURRENT_TIMESTAMP
        `);
        upsertStmt.run(JSON.stringify(updatedBook), req.user.id);

        res.json({ success: true, featuredBook: updatedBook });
    } catch (err) {
        console.error('PUT /api/content/featured-book error:', err);
        res.status(500).json({ success: false, error: 'Failed to update featured book.' });
    }
});

/**
 * PUT /api/content/salon
 * Curator-only: Updates the active literary salon / gathering
 */
router.put('/salon', requireAuth, requireCurator, (req, res) => {
    try {
        const { title, detail, month, day, attendees, host, status } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, error: 'Salon title is required.' });
        }

        const existing = getContentKey('current_salon', {});
        const updatedSalon = {
            ...existing,
            title: title.trim(),
            detail: (detail || existing.detail || '').trim(),
            month: (month || existing.month || 'Oct').trim(),
            day: (day || existing.day || '15').trim(),
            attendees: parseInt(attendees, 10) || existing.attendees || 100,
            host: host || existing.host || 'Wabi Sabi Curators',
            status: status || existing.status || 'UPCOMING'
        };

        const upsertStmt = db.prepare(`
            INSERT INTO site_content (key, value, updated_by, updated_at)
            VALUES ('current_salon', ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_by = excluded.updated_by,
                updated_at = CURRENT_TIMESTAMP
        `);
        upsertStmt.run(JSON.stringify(updatedSalon), req.user.id);

        res.json({ success: true, currentSalon: updatedSalon });
    } catch (err) {
        console.error('PUT /api/content/salon error:', err);
        res.status(500).json({ success: false, error: 'Failed to update salon.' });
    }
});

/**
 * PUT /api/content/prompts
 * Curator-only: Updates sticky note prompts across the sanctuary
 */
router.put('/prompts', requireAuth, requireCurator, (req, res) => {
    try {
        const { prompts } = req.body;
        if (!Array.isArray(prompts) || prompts.length === 0) {
            return res.status(400).json({ success: false, error: 'Array of prompts is required.' });
        }

        const upsertStmt = db.prepare(`
            INSERT INTO site_content (key, value, updated_by, updated_at)
            VALUES ('sticky_prompts', ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_by = excluded.updated_by,
                updated_at = CURRENT_TIMESTAMP
        `);
        upsertStmt.run(JSON.stringify(prompts), req.user.id);

        res.json({ success: true, stickyPrompts: prompts });
    } catch (err) {
        console.error('PUT /api/content/prompts error:', err);
        res.status(500).json({ success: false, error: 'Failed to update sticky prompts.' });
    }
});

module.exports = router;

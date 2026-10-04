const express = require('express');
const router = express.Router();
const { getAuthenticatedCurator } = require('../middleware/auth');

/**
 * GET /api/user/profile
 * Retrieves the recognized user state (either authenticated Curator or remembered Reader)
 */
router.get('/profile', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
        const curator = getAuthenticatedCurator(req);
        if (curator) {
            return res.json({
                success: true,
                isCurator: true,
                role: 'ADMIN',
                name: curator.displayName || 'Wabi Sabi Admin',
                handle: curator.handle || '@wabisabi',
                email: curator.email
            });
        }

        let reader = null;
        if (req.cookies && req.cookies.wabisabi_reader) {
            try {
                reader = JSON.parse(decodeURIComponent(req.cookies.wabisabi_reader));
            } catch (e) {
                reader = null;
            }
        }

        return res.json({
            success: true,
            isCurator: false,
            reader: reader
        });
    } catch (err) {
        console.error('Error fetching user profile:', err);
        return res.status(500).json({ success: false, error: 'Could not fetch user profile.' });
    }
});

/**
 * POST /api/user/profile
 * Saves the visitor's reader identity and reading preferences in a persistent 1-year cookie
 */
router.post('/profile', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const { name, moniker, genre } = body;
        for (const [field, value, max] of [['name', name, 100], ['moniker', moniker, 50], ['genre', genre, 100]]) {
            if (value !== undefined && (typeof value !== 'string' || value.trim().length > max)) {
                return res.status(400).json({ success: false, error: `${field} must be text of at most ${max} characters.` });
            }
        }
        const cleanName = (name || '').trim();
        const cleanMoniker = (moniker || '').trim();
        const cleanGenre = (genre || '').trim();

        if (!cleanName && !cleanMoniker) {
            return res.status(400).json({ success: false, error: 'Please provide a name or moniker.' });
        }

        const readerData = {
            name: cleanName || cleanMoniker,
            moniker: cleanMoniker,
            genre: cleanGenre,
            savedAt: new Date().toISOString()
        };

        // 1-year cookie for cross-session remembrance
        res.cookie('wabisabi_reader', encodeURIComponent(JSON.stringify(readerData)), {
            maxAge: 365 * 24 * 60 * 60 * 1000,
            httpOnly: false, // Accessible to client scripts
            sameSite: 'lax',
            path: '/'
        });

        return res.json({
            success: true,
            message: 'Sanctuary now remembers you.',
            reader: readerData
        });
    } catch (err) {
        console.error('Error saving user profile:', err);
        return res.status(500).json({ success: false, error: 'Could not save reader profile.' });
    }
});

/**
 * DELETE /api/user/profile
 * Clears remembered reader cookie
 */
router.delete('/profile', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.clearCookie('wabisabi_reader', { httpOnly: false, sameSite: 'lax', path: '/' });
    return res.json({ success: true, message: 'Reader profile traces cleared.' });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { db } = require('../db');
const { verifyPassword, generateSessionToken, hashSessionToken } = require('../crypto');
const { requireAuth, checkLoginRateLimit, recordLoginFailure, clearLoginFailures } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * One login endpoint, credentials verified with Argon2id.
 * The server decides role and destination — never the browser.
 */
router.post('/login', checkLoginRateLimit, async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Please enter both your email address and password.'
        });
    }

    try {
        const normalizedEmail = email.trim().toLowerCase();
        const userStmt = db.prepare(`
            SELECT id, email, password_hash, display_name, handle, role, status
            FROM users
            WHERE email = ?
        `);
        const user = userStmt.get(normalizedEmail);

        if (!user) {
            recordLoginFailure(req);
            return res.status(401).json({
                success: false,
                error: 'Invalid email address or password. Please verify your credentials.'
            });
        }

        const isMatch = await verifyPassword(password, user.password_hash);
        if (!isMatch) {
            recordLoginFailure(req);
            return res.status(401).json({
                success: false,
                error: 'Invalid email address or password. Please verify your credentials.'
            });
        }

        // Authentication succeeded: clear failed attempts
        clearLoginFailures(req);

        // Update last_login_at
        db.prepare(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);

        // Generate 32-byte cryptographic session token
        const rawToken = generateSessionToken();
        const tokenHash = hashSessionToken(rawToken);
        const sessionId = 'sess_' + crypto.randomUUID();

        // 30 days session expiry
        db.prepare(`
            INSERT INTO sessions (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, datetime('now', '+30 days'))
        `).run(sessionId, user.id, tokenHash);

        // Set secure HTTP-only cookie
        res.cookie('wabisabi_session', rawToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            path: '/'
        });

        // Determine destination based on server-verified identity
        let redirectUrl = '/community.html';
        if (user.role === 'CURATOR') {
            redirectUrl = '/curator.html';
        } else if (user.status === 'PENDING' || user.status === 'REJECTED') {
            redirectUrl = '/application-status.html';
        }

        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                handle: user.handle,
                role: user.role,
                status: user.status
            },
            redirectUrl
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({
            success: false,
            error: 'A server error occurred during authentication. Please try again.'
        });
    }
});

/**
 * POST /api/auth/logout
 * Destroys session in SQLite and clears the session cookie.
 */
router.post('/logout', (req, res) => {
    const rawToken = req.cookies ? req.cookies.wabisabi_session : null;
    if (rawToken) {
        try {
            const tokenHash = hashSessionToken(rawToken);
            db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
        } catch (err) {
            console.error('Logout session deletion error:', err);
        }
    }

    res.clearCookie('wabisabi_session', { httpOnly: true, sameSite: 'lax', path: '/' });
    return res.json({ success: true, message: 'Signed out successfully.' });
});

/**
 * GET /api/auth/session
 * Returns the currently active authenticated session and user profile.
 */
router.get('/session', requireAuth, (req, res) => {
    return res.json({
        success: true,
        user: req.user
    });
});

module.exports = router;

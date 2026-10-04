const express = require('express');
const router = express.Router();
const { getCuratorByIdentifier, createCuratorSession, deleteCuratorSession, updateCuratorLastLogin } = require('../db');
const { verifyPassword, generateSessionToken, hashSessionToken } = require('../crypto');
const {
    getAuthenticatedCurator,
    checkLoginRateLimit,
    recordLoginFailure,
    clearLoginFailures
} = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Authenticates one of the 3 Curators (Likith, Sarvasree, Dhanush)
 */
router.post('/login', checkLoginRateLimit, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const rawIdentifier = body.identifier ?? body.email ?? body.username;
        const identifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide both your curator username/email and password.'
            });
        }
        if (identifier.length > 254 || password.length > 1024) {
            return res.status(400).json({ success: false, error: 'Login details exceed the permitted length.' });
        }

        const curator = getCuratorByIdentifier(identifier);
        if (!curator) {
            recordLoginFailure(req);
            return res.status(401).json({
                success: false,
                error: 'Invalid curator credentials. Access is restricted to Wabi Sabi curators.'
            });
        }

        const isMatch = await verifyPassword(password, curator.password_hash);
        if (!isMatch) {
            recordLoginFailure(req);
            return res.status(401).json({
                success: false,
                error: 'Invalid curator credentials. Access is restricted to Wabi Sabi curators.'
            });
        }

        clearLoginFailures(req);
        updateCuratorLastLogin(curator.id);
        res.setHeader('Cache-Control', 'no-store');

        // Generate cryptographically secure session token
        const rawToken = generateSessionToken();
        const tokenHash = hashSessionToken(rawToken);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

        createCuratorSession(curator.id, tokenHash, expiresAt);

        // Set secure HTTP-only cookie
        res.cookie('wabisabi_curator_session', rawToken, {
            httpOnly: true,
            secure: req.secure || process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        // Set legacy cookie name too for backward compatibility
        res.cookie('wabisabi_session', rawToken, {
            httpOnly: true,
            secure: req.secure || process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        return res.json({
            success: true,
            curator: {
                id: curator.id,
                email: curator.email,
                displayName: curator.display_name,
                handle: curator.handle
            },
            user: {
                id: curator.id,
                email: curator.email,
                displayName: curator.display_name,
                handle: curator.handle,
                role: 'ADMIN'
            },
            redirectUrl: '/curator.html'
        });
    } catch (err) {
        console.error('Curator login error:', err);
        return res.status(500).json({ success: false, error: 'Curator login failed due to a server error.' });
    }
});

/**
 * POST /api/auth/logout
 * Terminates curator session
 */
router.post('/logout', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const rawToken = req.cookies ? (req.cookies.wabisabi_curator_session || req.cookies.wabisabi_session) : null;
        if (rawToken) {
            const tokenHash = hashSessionToken(rawToken);
            deleteCuratorSession(tokenHash);
        }

        res.clearCookie('wabisabi_curator_session', { httpOnly: true, sameSite: 'lax', path: '/' });
        res.clearCookie('wabisabi_session', { httpOnly: true, sameSite: 'lax', path: '/' });

        return res.json({ success: true, message: 'Curator session terminated.' });
    } catch (err) {
        console.error('Curator logout error:', err);
        return res.status(500).json({ success: false, error: 'Logout failed.' });
    }
});

/**
 * GET /api/auth/me & /api/auth/session
 * Retrieves current authenticated curator profile
 */
router.get(['/me', '/session'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const curator = getAuthenticatedCurator(req);
    if (!curator) {
        return res.json({
            success: false,
            authenticated: false,
            curator: null,
            user: null,
            message: 'Visitor mode (not logged in as a curator).'
        });
    }

    return res.json({
        success: true,
        authenticated: true,
        curator,
        user: curator
    });
});

module.exports = router;

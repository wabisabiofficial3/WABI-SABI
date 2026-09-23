const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { db } = require('../db');
const { hashPassword, generateSessionToken, hashSessionToken } = require('../crypto');
const { requireAuth } = require('../middleware/auth');

/**
 * Permanent Handle Validator
 * Rules:
 * 1. English letters only (a-z)
 * 2. 3 to 20 characters
 * 3. Spaces and punctuation are removed/disallowed
 */
function validateHandle(rawHandle) {
    if (!rawHandle || typeof rawHandle !== 'string') {
        return { isValid: false, message: 'A permanent handle is required.' };
    }
    const normalized = rawHandle.toLowerCase().trim().replace(/\s+/g, '').replace(/[^a-z]/g, '');
    const hasDisallowedChars = /[^a-zA-Z\s]/.test(rawHandle);

    if (hasDisallowedChars || normalized.length === 0) {
        return { isValid: false, message: 'Handles may only contain letters (no numbers, punctuation, or symbols).' };
    }
    if (normalized.length < 3 || normalized.length > 20) {
        return { isValid: false, message: 'Handles must be between 3 and 20 letters.' };
    }

    const existing = db.prepare('SELECT id FROM users WHERE handle = ?').get(normalized);
    if (existing) {
        return { isValid: false, message: 'This handle is already claimed by another member in the circle.' };
    }

    return { isValid: true, normalized };
}

/**
 * POST /api/application/submit
 * Submits a new membership application with account credentials and the 5 Wabi Sabi questions.
 * Status is set to PENDING. An unapproved member can never enter the community directly.
 */
router.post('/submit', async (req, res) => {
    const {
        name,
        email,
        password,
        handle,
        reason,
        favorite_work,
        perspective,
        contribution,
        conversation
    } = req.body || {};

    // 1. Basic field checks
    if (!name || !email || !password || !handle) {
        return res.status(400).json({
            success: false,
            error: 'Name, email, password, and permanent handle are required.'
        });
    }

    if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 6 characters long.'
        });
    }

    // 2. Validate the 5 questions
    if (!reason || !favorite_work || !perspective || !contribution || !conversation) {
        return res.status(400).json({
            success: false,
            error: 'Please answer all 5 questions so the Curators can review your application thoughtfully.'
        });
    }

    // 3. Validate Permanent Handle
    const handleVal = validateHandle(handle);
    if (!handleVal.isValid) {
        return res.status(400).json({
            success: false,
            error: handleVal.message
        });
    }

    // 4. Validate Email uniqueness
    const normalizedEmail = email.trim().toLowerCase();
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingEmail) {
        return res.status(400).json({
            success: false,
            error: 'An account with this email address already exists. Please sign in instead.'
        });
    }

    try {
        const userId = 'user_' + crypto.randomUUID();
        const applicationId = 'app_' + crypto.randomUUID();
        const passwordHash = await hashPassword(password);

        // Transactional insert for user + membership_application
        db.exec('BEGIN TRANSACTION;');
        try {
            db.prepare(`
                INSERT INTO users (id, email, password_hash, display_name, handle, role, status)
                VALUES (?, ?, ?, ?, ?, 'USER', 'PENDING')
            `).run(userId, normalizedEmail, passwordHash, name.trim(), handleVal.normalized);

            db.prepare(`
                INSERT INTO membership_applications (
                    id, user_id, reason, favorite_work, perspective, contribution, conversation, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
            `).run(
                applicationId,
                userId,
                reason.trim(),
                favorite_work.trim(),
                perspective.trim(),
                contribution.trim(),
                conversation.trim()
            );

            db.exec('COMMIT;');
        } catch (txnErr) {
            db.exec('ROLLBACK;');
            throw txnErr;
        }

        // Establish session so user can monitor application status
        const rawToken = generateSessionToken();
        const tokenHash = hashSessionToken(rawToken);
        const sessionId = 'sess_' + crypto.randomUUID();

        db.prepare(`
            INSERT INTO sessions (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, datetime('now', '+30 days'))
        `).run(sessionId, userId, tokenHash);

        res.cookie('wabisabi_session', rawToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        return res.status(201).json({
            success: true,
            message: 'Application received. A Curator will review your responses.',
            user: {
                id: userId,
                email: normalizedEmail,
                displayName: name.trim(),
                handle: handleVal.normalized,
                role: 'USER',
                status: 'PENDING'
            },
            redirectUrl: '/application-status.html'
        });
    } catch (err) {
        console.error('Application submission error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to process application. Please try again.'
        });
    }
});

/**
 * GET /api/application/status
 * Returns current status of authenticated user's application.
 */
router.get('/status', requireAuth, (req, res) => {
    try {
        const app = db.prepare(`
            SELECT id, reason, favorite_work, perspective, contribution, conversation,
                   status, reviewed_by, reviewed_at, curator_notes, created_at
            FROM membership_applications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `).get(req.user.id);

        return res.json({
            success: true,
            user: req.user,
            application: app || null
        });
    } catch (err) {
        console.error('Error fetching application status:', err);
        return res.status(500).json({ success: false, error: 'Could not fetch application status.' });
    }
});

module.exports = router;

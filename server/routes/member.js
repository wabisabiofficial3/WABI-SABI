const express = require('express');
const router = express.Router();
const {
    getMemberByCode,
    createMemberSession,
    deleteMemberSession,
    claimMemberPassWithSession,
    getMemberReading,
    getMemberBookshelf,
    getMemberNotifications,
    markMemberNotificationRead,
    markAllMemberNotificationsRead,
    updateMemberReading,
    getMemberNotes,
    addMemberNote,
    deleteMemberNote,
    getSetting
} = require('../db');
const { requireMember, optionalMember } = require('../middleware/memberAuth');

/**
 * POST /api/member/access
 * Member enters their unique Wabi Sabi Secret Code (WS-XXXX-XXXX-XXXX)
 * Creates a secure authenticated member session cookie.
 * No email, password, or username required.
 */
router.post('/access', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
        const rawCode = req.body?.secretCode || req.body?.code;
        if (!rawCode || typeof rawCode !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Please enter your Wabi Sabi Secret Code.'
            });
        }

        const cleanCode = rawCode.trim().toUpperCase();
        // Code alphabet excludes ambiguous 0/O and 1/I to reduce entry mistakes.
        if (!/^WS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(cleanCode)) {
            return res.status(401).json({ success: false, error: 'The code entered does not match an active circle member. Please check with your Curator.' });
        }
        const member = getMemberByCode(cleanCode);

        if (!member) {
            return res.status(401).json({
                success: false,
                error: 'The code entered does not match an active circle member. Please check with your Curator.'
            });
        }

        if (member.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: member.status === 'suspended'
                    ? 'This membership is currently resting. Please speak with your Curator.'
                    : 'This membership is not currently active. Please speak with your Curator.'
            });
        }

        // Establish secure 30-day member session
        const session = createMemberSession(member.id, 30);

        // Store session in secure HTTP-only cookie
        res.cookie('wabisabi_member_session', session.token, {
            httpOnly: true,
            sameSite: 'Lax',
            secure: req.secure || process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        return res.json({
            success: true,
            message: `Welcome to your desk, ${member.display_name || member.name}.`,
            redirect: '/my-space',
            redirectUrl: '/my-space',
            member: {
                name: member.display_name || member.name,
                displayName: member.display_name || member.name,
                handle: member.handle,
                date_joined: member.date_joined
            }
        });
    } catch (err) {
        console.error('Member access error:', err);
        return res.status(500).json({ success: false, error: 'Sanctuary door temporarily quiet. Please try again.' });
    }
});

/**
 * GET /api/member/status
 * Lightweight check used by public portal navigation to display "My Space" vs "Open My Space"
 */
router.get('/status', optionalMember, (req, res) => {
    if (req.member) {
        return res.json({
            authenticated: true,
            isMember: true,
            member: {
                id: req.member.id,
                name: req.member.display_name || req.member.name,
                displayName: req.member.display_name || req.member.name,
                handle: req.member.handle,
                role: 'USER'
            }
        });
    }
    return res.json({
        authenticated: false,
        isMember: false,
        member: null
    });
});

/**
 * GET /api/member/me
 * Retrieves current member's personal desk data
 */
router.get('/me', requireMember, (req, res) => {
    try {
        const member = req.member;
        const rawReading = getMemberReading(member.id);
        const reading = {
            id: rawReading.id,
            bookTitle: rawReading.book_title || rawReading.bookTitle || 'The Stranger',
            bookAuthor: rawReading.book_author || rawReading.bookAuthor || 'Albert Camus',
            progressPercent: rawReading.progress !== undefined ? rawReading.progress : (rawReading.progressPercent || 0),
            book_title: rawReading.book_title || 'The Stranger',
            book_author: rawReading.book_author || 'Albert Camus',
            progress: rawReading.progress !== undefined ? rawReading.progress : 0,
            status: rawReading.status || 'currently_reading',
            updated_at: rawReading.updated_at
        };

        const rawNotes = getMemberNotes(member.id);
        const notes = rawNotes.map(n => ({
            id: n.id,
            member_id: n.member_id,
            content: n.content,
            noteText: n.content,
            created_at: n.created_at
        }));
        const storedBookshelf = getMemberBookshelf(member.id);
        const bookshelf = storedBookshelf.length > 0
            ? storedBookshelf
            : [{
                id: rawReading.id || null,
                title: reading.book_title,
                author: reading.book_author,
                status: reading.status,
                progress: reading.progress,
                updated_at: reading.updated_at || null
            }];

        const gathering = getSetting('gathering') || getSetting('next_meeting') || {
            date: 'Saturday, 4 October',
            time: '4:00 PM',
            location: 'MRDU Campus'
        };

        return res.json({
            success: true,
            isCuratorPreview: Boolean(req.isCuratorPreview),
            curatorName: req.curator?.display_name || null,
            member: {
                id: member.id,
                name: member.display_name || member.name,
                full_name: member.full_name || member.name,
                display_name: member.display_name || member.name,
                handle: member.handle,
                role: member.role || 'Member',
                status: member.status || 'active',
                date_joined: member.date_joined || 'Recent',
                avatar_url: member.avatar_url || '../assets/user_avatar.jpg',
                bio: member.bio || ''
            },
            reading,
            notes,
            gathering,
            bookshelf
        });
    } catch (err) {
        console.error('Error fetching member desk:', err);
        return res.status(500).json({ success: false, error: 'Failed to open personal space.' });
    }
});

/**
 * GET /api/member/notifications
 * Returns the signed-in member's broadcast notifications and unread count.
 * Curator previews may read a target member's feed, but cannot mark it as read.
 */
router.get('/notifications', requireMember, (req, res) => {
    try {
        const result = getMemberNotifications(req.member.id);
        return res.json({ success: true, ...result, isCuratorPreview: Boolean(req.isCuratorPreview) });
    } catch (err) {
        console.error('Error fetching member notifications:', err);
        return res.status(500).json({ success: false, error: 'Could not load notifications.' });
    }
});

/** Mark one notification as read for the authenticated member only. */
router.post('/notifications/read-all', requireMember, (req, res) => {
    try {
        markAllMemberNotificationsRead(req.member.id);
        return res.json({ success: true, ...getMemberNotifications(req.member.id) });
    } catch (err) {
        console.error('Error marking member notifications as read:', err);
        return res.status(500).json({ success: false, error: 'Could not update notifications.' });
    }
});

router.post('/notifications/:id/read', requireMember, (req, res) => {
    try {
        if (!/^notif-[a-f0-9]{24}$/i.test(req.params.id)) {
            return res.status(404).json({ success: false, error: 'Notification not found.' });
        }
        if (!markMemberNotificationRead(req.member.id, req.params.id)) {
            return res.status(404).json({ success: false, error: 'Notification not found.' });
        }
        return res.json({ success: true, ...getMemberNotifications(req.member.id) });
    } catch (err) {
        console.error('Error marking member notification as read:', err);
        return res.status(500).json({ success: false, error: 'Could not update notification.' });
    }
});

/**
 * POST /api/member/reading
 * Update current reading title, author, or progress percentage
 */
router.post('/reading', requireMember, (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return res.status(400).json({ success: false, error: 'Reading update must be an object.' });
        }
        const body = req.body;
        const { book_title, bookTitle, book_author, bookAuthor, progress, progressPercent } = body;
        const title = bookTitle !== undefined ? bookTitle : book_title;
        const author = bookAuthor !== undefined ? bookAuthor : book_author;
        const p = progressPercent !== undefined ? progressPercent : progress;
        if (title !== undefined && (typeof title !== 'string' || title.trim().length > 200)) {
            return res.status(400).json({ success: false, error: 'Book title must be at most 200 characters.' });
        }
        if (author !== undefined && (typeof author !== 'string' || author.trim().length > 200)) {
            return res.status(400).json({ success: false, error: 'Book author must be at most 200 characters.' });
        }
        if (p !== undefined && ((typeof p !== 'number' && typeof p !== 'string') || String(p).trim() === '' || !Number.isFinite(Number(p)))) {
            return res.status(400).json({ success: false, error: 'Reading progress must be a number.' });
        }
        if (title === undefined && author === undefined && p === undefined) {
            return res.status(400).json({ success: false, error: 'Provide a title, author or progress value to update.' });
        }
        updateMemberReading(req.member.id, {
            book_title: title,
            book_author: author,
            progress: p
        });
        const rawReading = getMemberReading(req.member.id);
        const updated = {
            id: rawReading.id,
            bookTitle: rawReading.book_title,
            bookAuthor: rawReading.book_author,
            progressPercent: rawReading.progress,
            book_title: rawReading.book_title,
            book_author: rawReading.book_author,
            progress: rawReading.progress,
            status: rawReading.status
        };
        return res.json({ success: true, reading: updated });
    } catch (err) {
        console.error('Error updating reading progress:', err);
        return res.status(500).json({ success: false, error: 'Failed to update reading progress.' });
    }
});

/**
 * POST /api/member/notes
 * Add a new private literary reflection note
 */
router.post('/notes', requireMember, (req, res) => {
    try {
        const text = req.body?.noteText ?? req.body?.content ?? '';
        if (typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, error: 'Note reflection cannot be empty.' });
        }
        if (text.trim().length > 4000) {
            return res.status(400).json({ success: false, error: 'A reflection must be 4000 characters or fewer.' });
        }
        const noteId = addMemberNote(req.member.id, text.trim());
        const rawNotes = getMemberNotes(req.member.id);
        const notes = rawNotes.map(n => ({
            id: n.id,
            content: n.content,
            noteText: n.content,
            created_at: n.created_at
        }));
        const createdNote = notes.find(n => n.id === noteId) || { id: noteId, content: text.trim(), noteText: text.trim() };
        return res.status(200).json({
            success: true,
            noteId,
            note: createdNote,
            notes
        });
    } catch (err) {
        if (err.code === 'NOTE_LIMIT_REACHED') return res.status(409).json({ success: false, error: err.message });
        console.error('Error adding reflection note:', err);
        return res.status(500).json({ success: false, error: 'Failed to record reflection.' });
    }
});

/**
 * DELETE /api/member/notes/:id
 * Remove a private note
 */
router.delete('/notes/:id', requireMember, (req, res) => {
    try {
        const deleted = deleteMemberNote(req.params.id, req.member.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Reflection not found.' });
        const notes = getMemberNotes(req.member.id);
        return res.json({ success: true, notes });
    } catch (err) {
        console.error('Error deleting note:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete note.' });
    }
});

/**
 * POST /api/member/leave
 * Leaves member space and terminates active session
 */
router.post('/leave', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
        const memberToken = req.cookies?.wabisabi_member_session;
        if (memberToken) {
            deleteMemberSession(memberToken);
        }
        res.clearCookie('wabisabi_member_session', {
            httpOnly: true,
            sameSite: 'lax',
            secure: req.secure || process.env.NODE_ENV === 'production',
            path: '/'
        });
        return res.json({ success: true, message: 'You have quietly stepped out of your space.', redirect: '/' });
    } catch (err) {
        console.error('Error leaving member space:', err);
        return res.status(500).json({ success: false, error: 'Failed to leave space cleanly.' });
    }
});

/**
 * GET /api/member/claim-pass
 * Show an explicit confirmation before consuming a single-use QR pass. This keeps
 * mail/security scanners and speculative link previews from burning a member's pass.
 */
router.get('/claim-pass', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    const token = req.query.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{48}$/i.test(token)) {
        return res.redirect('/my-space?claim_error=invalid_or_expired');
    }

    return res.status(200).type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Open your Wabi Sabi space</title>
</head>
<body style="margin:0; min-height:100vh; display:grid; place-items:center; background:#f6f3ec; color:#273b2b; font-family:system-ui,sans-serif;">
<main style="max-width:28rem; margin:1.5rem; padding:2rem; border:1px solid #d9d0c1; border-radius:1rem; background:#fffdf8; text-align:center;">
<h1 style="font-family:Georgia,serif; font-weight:500;">Your member pass is ready</h1>
<p>Continue to open your private reading desk. This pass can be used once and expires after seven days.</p>
<form method="post" action="/api/member/claim-pass">
<input type="hidden" name="token" value="${token}">
<button type="submit" style="padding:.8rem 1.2rem; border:0; border-radius:.5rem; background:#273b2b; color:white; font:inherit; cursor:pointer;">Open My Space</button>
</form>
</main>
</body>
</html>`);
});

/**
 * POST /api/member/claim-pass
 * Consume the one-time QR pass, issue an HttpOnly session and open the member desk.
 */
router.post('/claim-pass', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
        const token = req.body?.token;
        if (typeof token !== 'string' || !/^[a-f0-9]{48}$/i.test(token)) {
            return res.redirect('/my-space?claim_error=invalid_or_expired');
        }
        const session = claimMemberPassWithSession(token, 30);
        if (!session) return res.redirect('/my-space?claim_error=invalid_or_expired');

        res.cookie('wabisabi_member_session', session.token, {
            httpOnly: true,
            sameSite: 'Lax',
            secure: req.secure || process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/'
        });
        return res.redirect('/my-space');
    } catch (err) {
        console.error('QR claim pass error:', err);
        return res.redirect('/my-space?claim_error=server_error');
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const {
    getMemberByCode,
    createMemberSession,
    deleteMemberSession,
    claimMemberPass,
    getMemberReading,
    updateMemberReading,
    getMemberNotes,
    addMemberNote,
    deleteMemberNote,
    getSetting
} = require('../db');
const { requireMember, optionalMember } = require('../middleware/memberAuth');

/**
 * POST /api/member/access
 * Member enters their Secret Code (e.g. WS-7K4M-X92P-LQ8A)
 * Creates a secure authenticated member session cookie.
 * No email, password, or username required.
 */
router.post('/access', (req, res) => {
    try {
        const rawCode = req.body?.secretCode || req.body?.code;
        if (!rawCode || typeof rawCode !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Please enter your Wabi Sabi Secret Code.'
            });
        }

        const cleanCode = rawCode.trim().toUpperCase();
        // Validate code structure WS-XXXX-XXXX-XXXX
        const member = getMemberByCode(cleanCode);

        if (!member) {
            return res.status(401).json({
                success: false,
                error: 'The code entered does not match an active circle member. Please check with your Curator.'
            });
        }

        if (member.status === 'suspended') {
            return res.status(403).json({
                success: false,
                error: 'This membership is currently resting. Please speak with your Curator.'
            });
        }

        // Establish secure 30-day member session
        const session = createMemberSession(member.id, 30);

        // Store session in secure HTTP-only cookie
        res.cookie('wabisabi_member_session', session.token, {
            httpOnly: true,
            sameSite: 'Lax',
            secure: process.env.NODE_ENV === 'production',
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
                name: req.member.display_name || req.member.name,
                displayName: req.member.display_name || req.member.name,
                handle: req.member.handle
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
            bookshelf: [
                {
                    title: 'The Stranger',
                    author: 'Albert Camus',
                    status: 'currently_reading',
                    progress: reading.progress || 62
                },
                {
                    title: 'In Praise of Shadows',
                    author: 'Jun’ichirō Tanizaki',
                    status: 'saved',
                    progress: 100
                },
                {
                    title: 'Norwegian Wood',
                    author: 'Haruki Murakami',
                    status: 'saved',
                    progress: 30
                }
            ]
        });
    } catch (err) {
        console.error('Error fetching member desk:', err);
        return res.status(500).json({ success: false, error: 'Failed to open personal space.' });
    }
});

/**
 * POST /api/member/reading
 * Update current reading title, author, or progress percentage
 */
router.post('/reading', requireMember, (req, res) => {
    try {
        const { book_title, bookTitle, book_author, bookAuthor, progress, progressPercent } = req.body || {};
        const p = progressPercent !== undefined ? progressPercent : progress;
        updateMemberReading(req.member.id, {
            book_title: bookTitle || book_title,
            book_author: bookAuthor || book_author,
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
        const text = req.body?.noteText || req.body?.content || '';
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, error: 'Note reflection cannot be empty.' });
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
        deleteMemberNote(req.params.id, req.member.id);
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
    try {
        const memberToken = req.cookies.wabisabi_member_session;
        if (memberToken) {
            deleteMemberSession(memberToken);
        }
        res.clearCookie('wabisabi_member_session', { path: '/' });
        return res.json({ success: true, message: 'You have quietly stepped out of your space.', redirect: '/' });
    } catch (err) {
        console.error('Error leaving member space:', err);
        return res.status(500).json({ success: false, error: 'Failed to leave space cleanly.' });
    }
});

/**
 * GET /api/member/claim-pass
 * Secure QR code membership card access mechanism
 * Scanning QR establishes authenticated session and redirects to /my-space
 */
router.get('/claim-pass', (req, res) => {
    try {
        const token = req.query.token;
        if (!token) {
            return res.redirect('/my-space?claim_error=missing_token');
        }

        const memberId = claimMemberPass(token);
        if (!memberId) {
            return res.redirect('/my-space?claim_error=invalid_or_expired');
        }

        const session = createMemberSession(memberId, 30);
        res.cookie('wabisabi_member_session', session.token, {
            httpOnly: true,
            sameSite: 'Lax',
            secure: process.env.NODE_ENV === 'production',
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

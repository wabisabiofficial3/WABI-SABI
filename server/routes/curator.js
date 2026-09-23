const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { db } = require('../db');
const { requireAuth, requireCurator } = require('../middleware/auth');

// Apply auth + curator role requirement across all /api/curator routes
router.use(requireAuth, requireCurator);

/**
 * GET /api/curator/applications
 * Returns applications, optionally filtered by ?status=PENDING
 */
router.get('/applications', (req, res) => {
    const statusFilter = req.query.status;
    let sql = `
        SELECT a.id, a.user_id, a.reason, a.favorite_work, a.perspective, a.contribution,
               a.conversation, a.status, a.reviewed_by, a.reviewed_at, a.curator_notes, a.created_at,
               u.email, u.display_name, u.handle, u.created_at AS user_created_at,
               r.display_name AS reviewer_name, r.handle AS reviewer_handle
        FROM membership_applications a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN users r ON a.reviewed_by = r.id
    `;
    const params = [];

    if (statusFilter) {
        sql += ' WHERE a.status = ?';
        params.push(statusFilter.toUpperCase());
    }

    sql += ' ORDER BY a.created_at DESC';

    try {
        const applications = db.prepare(sql).all(...params);
        return res.json({ success: true, applications });
    } catch (err) {
        console.error('Error fetching applications:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch applications.' });
    }
});

/**
 * GET /api/curator/applications/:id
 * Fetches full detail of a specific application
 */
router.get('/applications/:id', (req, res) => {
    try {
        const app = db.prepare(`
            SELECT a.id, a.user_id, a.reason, a.favorite_work, a.perspective, a.contribution,
                   a.conversation, a.status, a.reviewed_by, a.reviewed_at, a.curator_notes, a.created_at,
                   u.email, u.display_name, u.handle, u.created_at AS user_created_at,
                   r.display_name AS reviewer_name, r.handle AS reviewer_handle
            FROM membership_applications a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN users r ON a.reviewed_by = r.id
            WHERE a.id = ?
        `).get(req.params.id);

        if (!app) {
            return res.status(404).json({ success: false, error: 'Application not found.' });
        }

        return res.json({ success: true, application: app });
    } catch (err) {
        console.error('Error fetching application detail:', err);
        return res.status(500).json({ success: false, error: 'Failed to load application detail.' });
    }
});

/**
 * POST /api/curator/applications/:id/approve
 * Approves applicant: sets application APPROVED, user ACTIVE, records admin audit log.
 */
router.post('/applications/:id/approve', (req, res) => {
    const applicationId = req.params.id;
    const { notes } = req.body || {};

    try {
        const app = db.prepare('SELECT id, user_id, status FROM membership_applications WHERE id = ?').get(applicationId);
        if (!app) {
            return res.status(404).json({ success: false, error: 'Application not found.' });
        }

        db.exec('BEGIN TRANSACTION;');
        try {
            // Update application
            db.prepare(`
                UPDATE membership_applications
                SET status = 'APPROVED',
                    reviewed_by = ?,
                    reviewed_at = CURRENT_TIMESTAMP,
                    curator_notes = ?
                WHERE id = ?
            `).run(req.user.id, notes || 'Approved for Circle membership.', applicationId);

            // Update user status to ACTIVE
            db.prepare(`
                UPDATE users
                SET status = 'ACTIVE',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(app.user_id);

            // Record audit log
            const logId = 'log_' + crypto.randomUUID();
            db.prepare(`
                INSERT INTO admin_audit_logs (id, admin_id, action, target_user_id, metadata)
                VALUES (?, ?, 'APPROVE_MEMBER', ?, ?)
            `).run(
                logId,
                req.user.id,
                app.user_id,
                JSON.stringify({
                    applicationId,
                    adminName: req.user.displayName,
                    adminHandle: req.user.handle,
                    notes: notes || 'Approved for Circle membership.'
                })
            );

            db.exec('COMMIT;');
        } catch (txnErr) {
            db.exec('ROLLBACK;');
            throw txnErr;
        }

        return res.json({
            success: true,
            message: 'Applicant approved. They now have active access to the Community Space.'
        });
    } catch (err) {
        console.error('Approval error:', err);
        return res.status(500).json({ success: false, error: 'Failed to approve application.' });
    }
});

/**
 * POST /api/curator/applications/:id/reject
 * Rejects applicant: sets application REJECTED, user REJECTED, records admin audit log.
 */
router.post('/applications/:id/reject', (req, res) => {
    const applicationId = req.params.id;
    const { notes } = req.body || {};

    try {
        const app = db.prepare('SELECT id, user_id, status FROM membership_applications WHERE id = ?').get(applicationId);
        if (!app) {
            return res.status(404).json({ success: false, error: 'Application not found.' });
        }

        db.exec('BEGIN TRANSACTION;');
        try {
            // Update application
            db.prepare(`
                UPDATE membership_applications
                SET status = 'REJECTED',
                    reviewed_by = ?,
                    reviewed_at = CURRENT_TIMESTAMP,
                    curator_notes = ?
                WHERE id = ?
            `).run(req.user.id, notes || null, applicationId);

            // Update user status to REJECTED
            db.prepare(`
                UPDATE users
                SET status = 'REJECTED',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(app.user_id);

            // Record audit log
            const logId = 'log_' + crypto.randomUUID();
            db.prepare(`
                INSERT INTO admin_audit_logs (id, admin_id, action, target_user_id, metadata)
                VALUES (?, ?, 'REJECT_MEMBER', ?, ?)
            `).run(
                logId,
                req.user.id,
                app.user_id,
                JSON.stringify({
                    applicationId,
                    adminName: req.user.displayName,
                    adminHandle: req.user.handle,
                    notes: notes || 'Application not accepted at this time.'
                })
            );

            db.exec('COMMIT;');
        } catch (txnErr) {
            db.exec('ROLLBACK;');
            throw txnErr;
        }

        return res.json({
            success: true,
            message: 'Application marked as rejected.'
        });
    } catch (err) {
        console.error('Rejection error:', err);
        return res.status(500).json({ success: false, error: 'Failed to reject application.' });
    }
});

/**
 * GET /api/curator/audit-logs
 * Accountability trail for all administrative curator actions
 */
router.get('/audit-logs', (req, res) => {
    try {
        const logs = db.prepare(`
            SELECT l.id, l.admin_id, l.action, l.target_user_id, l.metadata, l.created_at,
                   a.display_name AS admin_name, a.handle AS admin_handle,
                   t.display_name AS target_name, t.handle AS target_handle
            FROM admin_audit_logs l
            JOIN users a ON l.admin_id = a.id
            LEFT JOIN users t ON l.target_user_id = t.id
            ORDER BY l.created_at DESC
            LIMIT 100
        `).all();

        return res.json({ success: true, logs });
    } catch (err) {
        console.error('Audit logs error:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch audit logs.' });
    }
});

/**
 * GET /api/curator/members
 * Complete list of registered users and statuses
 */
router.get('/members', (req, res) => {
    try {
        const members = db.prepare(`
            SELECT id, email, display_name, handle, role, status, created_at, last_login_at
            FROM users
            ORDER BY created_at ASC
        `).all();

        return res.json({ success: true, members });
    } catch (err) {
        console.error('Error fetching members:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch member registry.' });
    }
});

module.exports = router;

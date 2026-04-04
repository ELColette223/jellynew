'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { notifyStatusChange } = require('../services/notifications');
const { emitToUser } = require('../services/sseManager');

const router = express.Router();

const VALID_STATUSES = [ 'open', 'searching', 'processing', 'closed', 'rejected' ];

/**
 * GET /api/admin/tickets
 * Returns all tickets with optional status filter.
 */
router.get('/', requireAdmin, (req, res) => {
    const { status, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const whereClause = status && VALID_STATUSES.includes(status)
        ? `WHERE status = '${status}'`
        : '';

    const total = db
        .prepare(`SELECT COUNT(*) as cnt FROM tickets ${whereClause}`)
        .get().cnt;

    const rows = db
        .prepare(
            `SELECT id, user_id, user_name, user_email, title, type, description,
                    year, tmdb_id, imdb_id, insisted, status, admin_notes, created_at, updated_at
             FROM tickets
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`
        )
        .all(limitNum, offset);

    res.json({ total, page: pageNum, limit: limitNum, rows });
});

/**
 * GET /api/admin/tickets/:id
 * Returns full ticket with history.
 */
router.get('/:id', requireAdmin, (req, res) => {
    const ticket = db
        .prepare('SELECT * FROM tickets WHERE id = ?')
        .get(req.params.id);

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const history = db
        .prepare(
            `SELECT old_status, new_status, changed_by, note, created_at
             FROM ticket_history
             WHERE ticket_id = ?
             ORDER BY created_at ASC`
        )
        .all(ticket.id);

    res.json({ ...ticket, history });
});

/**
 * PATCH /api/admin/tickets/:id
 * Updates ticket status and/or admin notes.
 *
 * Body:
 *   status      (optional, must be a valid status)
 *   admin_notes (optional)
 */
router.patch('/:id', requireAdmin, async (req, res) => {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { status, admin_notes } = req.body;
    const adminName = req.jellyfinUser.Name;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` });
    }

    const newStatus = status ?? ticket.status;
    const newNotes = admin_notes !== undefined ? String(admin_notes) : ticket.admin_notes;

    db.prepare(
        `UPDATE tickets SET status = ?, admin_notes = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(newStatus, newNotes, ticket.id);

    if (status && status !== ticket.status) {
        db.prepare(
            `INSERT INTO ticket_history (ticket_id, old_status, new_status, changed_by, note)
             VALUES (?, ?, ?, ?, ?)`
        ).run(ticket.id, ticket.status, newStatus, adminName, admin_notes || null);

        const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id);
        await notifyStatusChange(updated, newStatus);

        emitToUser(String(ticket.user_id), 'ticket_updated', {
            id: ticket.id,
            title: ticket.title,
            status: newStatus
        });
    }

    res.json({ id: ticket.id, status: newStatus, admin_notes: newNotes });
});

/**
 * DELETE /api/admin/tickets/:id
 * Permanently deletes a ticket.
 */
router.delete('/:id', requireAdmin, (req, res) => {
    const info = db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.status(204).send();
});

module.exports = router;

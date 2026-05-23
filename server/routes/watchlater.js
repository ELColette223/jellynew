'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/watchlater
 * Returns all watch-later items for the authenticated user, newest first.
 */
router.get('/', requireAuth, (req, res) => {
    const rows = db
        .prepare(
            `SELECT id, item_id, item_title, item_type, item_year, added_at
             FROM watch_later
             WHERE user_id = ?
             ORDER BY added_at DESC`
        )
        .all(req.jellyfinUser.Id);

    res.json(rows);
});

/**
 * POST /api/watchlater
 * Adds an item to the authenticated user's watch-later list.
 * Body: { item_id, item_title, item_type?, item_year? }
 */
router.post('/', requireAuth, (req, res) => {
    const { item_id, item_title, item_type, item_year } = req.body ?? {};

    if (!item_id || typeof item_id !== 'string') {
        return res.status(400).json({ error: 'item_id is required' });
    }
    if (!item_title || typeof item_title !== 'string') {
        return res.status(400).json({ error: 'item_title is required' });
    }

    db.prepare(
        `INSERT INTO watch_later (user_id, item_id, item_title, item_type, item_year)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, item_id) DO NOTHING`
    ).run(
        req.jellyfinUser.Id,
        item_id,
        item_title,
        item_type ?? null,
        item_year ?? null
    );

    res.status(201).json({ ok: true });
});

/**
 * DELETE /api/watchlater/:itemId
 * Removes a specific item from the authenticated user's watch-later list.
 */
router.delete('/:itemId', requireAuth, (req, res) => {
    const { itemId } = req.params;

    db.prepare(
        'DELETE FROM watch_later WHERE user_id = ? AND item_id = ?'
    ).run(req.jellyfinUser.Id, itemId);

    res.status(204).end();
});

/**
 * GET /api/watchlater/:itemId/status
 * Returns whether a specific item is in the user's watch-later list.
 */
router.get('/:itemId/status', requireAuth, (req, res) => {
    const { itemId } = req.params;

    const row = db.prepare(
        'SELECT 1 FROM watch_later WHERE user_id = ? AND item_id = ? LIMIT 1'
    ).get(req.jellyfinUser.Id, itemId);

    res.json({ inWatchLater: !!row });
});

module.exports = router;

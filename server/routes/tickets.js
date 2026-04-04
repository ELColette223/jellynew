'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth, validateToken, resolveJellyfinUrl } = require('../middleware/auth');
const { searchContent } = require('../services/jellyfin');
const { notifyNewTicket } = require('../services/notifications');
const { getEmailByJellyfinId } = require('../services/userLookup');
const { addConnection, removeConnection } = require('../services/sseManager');

const router = express.Router();

const createLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many ticket requests, please try again later.' }
});

/**
 * GET /api/tickets
 * Returns all tickets belonging to the authenticated user.
 */
router.get('/', requireAuth, (req, res) => {
    const rows = db
        .prepare(
            `SELECT id, title, type, description, year, status, insisted, admin_notes, created_at, updated_at
             FROM tickets
             WHERE user_id = ?
             ORDER BY created_at DESC`
        )
        .all(req.jellyfinUser.Id);

    res.json(rows);
});

/**
 * GET /api/tickets/events
 * Server-Sent Events stream for real-time ticket status updates.
 * Auth token is passed as a query param because the browser EventSource API
 * does not support custom request headers.
 */
router.get('/events', async (req, res) => {
    const rawToken = req.query.token;
    if (!rawToken || typeof rawToken !== 'string') {
        return res.status(401).json({ error: 'Token required' });
    }

    // X-Jellyfin-Server can't be sent via EventSource, so the URL is passed
    // as a query param instead and resolved the same way.
    const jellyfinServerUrl = req.query.jellyfinServer || resolveJellyfinUrl(null);
    const user = await validateToken(`MediaBrowser Token="${rawToken}"`, jellyfinServerUrl);
    if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    // Confirm connection to the client
    res.write(': connected\n\n');

    const userId = user.Id;
    addConnection(userId, res);

    // Keep-alive heartbeat every 25 s to prevent proxy/firewall timeouts
    const heartbeat = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { /* ignore */ }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        removeConnection(userId, res);
    });
});

/**
 * GET /api/tickets/:id
 * Returns a single ticket owned by the authenticated user.
 */
router.get('/:id', requireAuth, (req, res) => {
    const row = db
        .prepare(
            `SELECT id, title, type, description, year, status, insisted, admin_notes, created_at, updated_at
             FROM tickets
             WHERE id = ? AND user_id = ?`
        )
        .get(req.params.id, req.jellyfinUser.Id);

    if (!row) return res.status(404).json({ error: 'Ticket not found' });
    res.json(row);
});

/**
 * POST /api/tickets/search
 * Checks the Jellyfin library for matching content.
 * Used by the frontend before showing the creation form.
 */
router.post('/search', requireAuth, async (req, res) => {
    const { query, year } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters.' });
    }

    const authHeader = req.headers['authorization'] || req.headers['x-emby-authorization'];
    const results = await searchContent(authHeader, query.trim(), year || null, req.jellyfinServerUrl);

    res.json({ results });
});

/**
 * POST /api/tickets
 * Creates a new ticket.
 *
 * Body fields:
 *   title       (required)
 *   type        movie | show | music | book | other
 *   description (required)
 *   year        (optional)
 *   tmdb_id     (optional)
 *   imdb_id     (optional)
 *   insisted    boolean – user is insisting even though content was found
 */
router.post('/', requireAuth, createLimiter, async (req, res) => {
    const user = req.jellyfinUser;
    const { title, type, description, year, tmdb_id, imdb_id, insisted } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length < 1) {
        return res.status(400).json({ error: 'Title is required.' });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return res.status(400).json({ error: 'Description must be at least 5 characters.' });
    }

    const allowedTypes = [ 'movie', 'show', 'music', 'book', 'other' ];
    const ticketType = allowedTypes.includes(type) ? type : 'other';

    const stmt = db.prepare(
        `INSERT INTO tickets (user_id, user_name, user_email, title, type, description, year, tmdb_id, imdb_id, insisted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // Resolve the user's email from the register service at creation time so it is
    // persisted on the ticket row and available for all future notifications.
    const resolvedEmail = await getEmailByJellyfinId(user.Id);

    const info = stmt.run(
        user.Id,
        user.Name,
        resolvedEmail,
        title.trim(),
        ticketType,
        description.trim(),
        year ? parseInt(year, 10) : null,
        tmdb_id || null,
        imdb_id || null,
        insisted ? 1 : 0
    );

    // Re-fetch full row to pass into notification
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid);

    // Notify the admin about the new request
    await notifyNewTicket(ticket);

    res.status(201).json({
        id: ticket.id,
        status: ticket.status,
        created_at: ticket.created_at
    });
});

module.exports = router;

'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { sendAdminNewTicketEmail } = require('../services/notifications');

const router = express.Router();

/** Helper: read a setting value from the DB */
function getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
}

/** Helper: write a setting value */
function setSetting(key, value) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

/**
 * GET /api/admin/settings
 * Returns the current ticket-system settings.
 *
 * Response shape:
 *   { admin_email: string, notify_client: boolean, smtp_configured: boolean }
 */
router.get('/', requireAdmin, (_req, res) => {
    const adminEmail = getSetting('admin_email') || '';
    const notifyClient = getSetting('notify_client') !== 'false';
    const smtpConfigured = Boolean(
        process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    );

    res.json({ admin_email: adminEmail, notify_client: notifyClient, smtp_configured: smtpConfigured });
});

/**
 * PUT /api/admin/settings
 * Updates ticket-system settings.
 *
 * Body (all optional):
 *   admin_email   string  – destination for new-ticket notifications to admin
 *   notify_client boolean – whether to email the requesting user on status changes
 */
router.put('/', requireAdmin, (req, res) => {
    const { admin_email, notify_client } = req.body;

    if (admin_email !== undefined) {
        setSetting('admin_email', String(admin_email).trim());
    }

    if (notify_client !== undefined) {
        setSetting('notify_client', notify_client ? 'true' : 'false');
    }

    res.json({ ok: true });
});

/**
 * POST /api/admin/settings/test-email
 * Sends a test email to the admin_email address using the .env SMTP config.
 */
router.post('/test-email', requireAdmin, async (req, res) => {
    const adminEmail = getSetting('admin_email') || '';
    if (!adminEmail) {
        return res.status(400).json({ error: 'Nenhum e-mail de administrador configurado.' });
    }

    const smtpConfigured = Boolean(
        process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    );
    if (!smtpConfigured) {
        return res.status(400).json({ error: 'SMTP não configurado no arquivo .env.' });
    }

    // Send a test new-ticket notification to the admin address.
    // We temporarily override admin_email via a synthetic ticket so the
    // real sendAdminNewTicketEmail path is exercised end-to-end.
    const fakeTicket = {
        user_id: null,
        user_name: 'Usuário de Teste',
        user_email: null,
        title: 'Pedido de Teste',
        type: 'movie',
        description: 'Este é um e-mail de teste enviado pelo painel de administração.',
        year: null,
        insisted: 0,
        admin_notes: null
    };

    try {
        await sendAdminNewTicketEmail(fakeTicket);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
module.exports.getSetting = getSetting;

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notifyContentReport, notifyContentReportStatusChange } = require('../services/notifications');
const { getEmailByJellyfinId } = require('../services/userLookup');

const clientRouter = express.Router();
const adminRouter = express.Router();

const reportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyGenerator: (req) => {
        return req.jellyfinUser?.Id || req.ip;
    },
    message: { error: 'Limite de envio excedido. Tente novamente em 15 minutos.' }
});

/**
 * POST /api/reports
 * Creates a new content report.
 */
clientRouter.post('/', requireAuth, reportLimiter, async (req, res) => {
    const { item_id, item_title, item_type, item_year, description } = req.body;

    if (!item_id || typeof item_id !== 'string' || item_id.trim().length < 1) {
        return res.status(400).json({ error: 'ID do item é obrigatório.' });
    }
    if (!item_title || typeof item_title !== 'string' || item_title.trim().length < 1) {
        return res.status(400).json({ error: 'Título do item é obrigatório.' });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 4) {
        return res.status(400).json({ error: 'Descrição precisa ter pelo menos 4 caracteres.' });
    }

    try {
        const resolvedEmail = await getEmailByJellyfinId(req.jellyfinUser.Id);

        const stmt = db.prepare(
            `INSERT INTO content_reports (user_id, user_name, user_email, item_id, item_title, item_type, item_year, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const info = stmt.run(
            req.jellyfinUser.Id,
            req.jellyfinUser.Name,
            resolvedEmail,
            item_id.trim(),
            item_title.trim(),
            item_type || null,
            item_year ? parseInt(item_year, 10) : null,
            description.trim()
        );

        const report = db.prepare('SELECT * FROM content_reports WHERE id = ?').get(info.lastInsertRowid);

        // Notify admin in background
        notifyContentReport(report).catch(err => {
            console.error('[reports] Error sending notification:', err.message);
        });

        res.status(201).json({ ok: true, id: report.id });
    } catch (err) {
        console.error('[reports] Error creating report:', err.message);
        res.status(500).json({ error: 'Erro interno ao salvar reporte.' });
    }
});

/**
 * GET /api/admin/reports
 * Lists all reports with optional filtering by resolution status.
 */
adminRouter.get('/', requireAdmin, (req, res) => {
    const { resolved, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    const queryParams = [];

    if (resolved !== undefined) {
        whereClause = 'WHERE resolved = ?';
        queryParams.push(resolved === 'true' || resolved === '1' ? 1 : 0);
    }

    try {
        const total = db
            .prepare(`SELECT COUNT(*) as cnt FROM content_reports ${whereClause}`)
            .get(...queryParams).cnt;

        const rows = db
            .prepare(
                `SELECT id, user_id, user_name, user_email, item_id, item_title, item_type, item_year, description, resolved, created_at
                 FROM content_reports
                 ${whereClause}
                 ORDER BY created_at DESC
                 LIMIT ? OFFSET ?`
            )
            .all(...queryParams, limitNum, offset);

        res.json({ total, page: pageNum, limit: limitNum, rows });
    } catch (err) {
        console.error('[reports-admin] Error listing reports:', err.message);
        res.status(500).json({ error: 'Erro interno ao consultar reportes.' });
    }
});

/**
 * PATCH /api/admin/reports/:id
 * Updates report status (resolved vs unresolved).
 */
adminRouter.patch('/:id', requireAdmin, (req, res) => {
    const { resolved } = req.body;

    if (resolved === undefined) {
        return res.status(400).json({ error: 'Campo resolved é obrigatório.' });
    }

    try {
        const report = db.prepare('SELECT * FROM content_reports WHERE id = ?').get(req.params.id);
        if (!report) {
            return res.status(404).json({ error: 'Reporte não encontrado.' });
        }

        const resolvedVal = (resolved === true || resolved === 1 || resolved === 'true') ? 1 : 0;

        db.prepare('UPDATE content_reports SET resolved = ? WHERE id = ?').run(resolvedVal, report.id);

        const updatedReport = db.prepare('SELECT * FROM content_reports WHERE id = ?').get(report.id);
        notifyContentReportStatusChange(updatedReport).catch(err => {
            console.error('[reports] Error sending status notification:', err.message);
        });

        res.json({ id: report.id, resolved: resolvedVal });
    } catch (err) {
        console.error('[reports-admin] Error updating report:', err.message);
        res.status(500).json({ error: 'Erro interno ao atualizar reporte.' });
    }
});

/**
 * DELETE /api/admin/reports/:id
 * Permanently deletes a report.
 */
adminRouter.delete('/:id', requireAdmin, (req, res) => {
    try {
        const info = db.prepare('DELETE FROM content_reports WHERE id = ?').run(req.params.id);
        if (info.changes === 0) {
            return res.status(404).json({ error: 'Reporte não encontrado.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('[reports-admin] Error deleting report:', err.message);
        res.status(500).json({ error: 'Erro interno ao excluir reporte.' });
    }
});

module.exports = {
    client: clientRouter,
    admin: adminRouter
};

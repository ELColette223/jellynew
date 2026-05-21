'use strict';

const nodemailer = require('nodemailer');
const { getEmailByJellyfinId } = require('./userLookup');

// Lazily created transporter so missing config doesn't crash startup
let _transporter = null;
function getTransporter() {
    if (_transporter) return _transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

    _transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '587', 10),
        secure: SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    return _transporter;
}

const STATUS_LABELS = {
    open: 'Aberto',
    searching: 'Procurando / Baixando',
    processing: 'Processando',
    closed: 'Concluído',
    rejected: 'Recusado'
};

/**
 * Reads a setting from the ticket DB. Imported lazily to avoid circular deps.
 */
function getSetting(key) {
    try {
        const db = require('../db');
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? row.value : null;
    } catch {
        return null;
    }
}

/**
 * Resolves the email for a ticket's owner.
 *
 * Priority:
 *   1. ticket.user_email  – already persisted on the ticket row at creation time
 *   2. userLookup HTTP    – calls the jellyfin-register API by jellyfin_user_id
 *   3. null               – user has no email; notification is skipped silently
 *
 * @param {object} ticket  – ticket row from the tickets DB
 * @returns {Promise<string|null>}
 */
async function resolveUserEmail(ticket) {
    if (ticket.user_email) return ticket.user_email;
    return getEmailByJellyfinId(ticket.user_id);
}

/**
 * Sends an email notification to the requesting user when their ticket status changes.
 * Silently skips when SMTP is not configured or the user has no resolvable email.
 */
async function sendEmailNotification(ticket, newStatus) {
    const transporter = getTransporter();
    if (!transporter) return;

    const email = await resolveUserEmail(ticket);
    if (!email) return;

    const label = STATUS_LABELS[newStatus] || newStatus;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    const subject = `[Pedido de Conteúdo] "${ticket.title}" — ${label}`;

    const bodyLines = [
        `Olá, ${ticket.user_name}!`,
        '',
        `O status do seu pedido "${ticket.title}" foi atualizado.`,
        '',
        `Novo status: ${label}`,
        ...(ticket.admin_notes ? [ '', `Nota do administrador: ${ticket.admin_notes}` ] : []),
        '',
        newStatus === 'closed'
            ? 'O conteúdo foi adicionado à plataforma. Bom entretenimento!'
            : 'Você será notificado novamente quando houver uma nova atualização.',
        '',
        '— Equipe Jellyfin'
    ];

    try {
        await transporter.sendMail({
            from,
            to: email,
            subject,
            text: bodyLines.join('\n')
        });
    } catch (err) {
        console.error('[notifications] Failed to send email to client:', err.message);
    }
}

/**
 * Sends an email to the admin notifying of a new content request.
 * Uses the admin_email stored in the settings table.
 * Silently skips when SMTP is not configured or no admin email is set.
 */
async function sendAdminNewTicketEmail(ticket) {
    const transporter = getTransporter();
    if (!transporter) return;

    const adminEmail = getSetting('admin_email') || process.env.SMTP_ADMIN_EMAIL || process.env.SMTP_USER || '';
    if (!adminEmail) return;

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    const typeLabels = {
        movie: 'Filme',
        show: 'Série',
        music: 'Música',
        book: 'Livro',
        other: 'Outro'
    };

    // Resolve the user's email so the admin knows who to contact directly
    const userEmail = await resolveUserEmail(ticket);

    const subject = `[Novo Pedido] "${ticket.title}" — ${typeLabels[ticket.type] || ticket.type}`;

    const bodyLines = [
        'Um novo pedido de conteúdo foi recebido.',
        '',
        `Título: ${ticket.title}`,
        `Tipo: ${typeLabels[ticket.type] || ticket.type}`,
        ...(ticket.year ? [ `Ano: ${ticket.year}` ] : []),
        `Usuário: ${ticket.user_name}`,
        ...(userEmail ? [ `E-mail do usuário: ${userEmail}` ] : []),
        '',
        'Descrição:',
        ticket.description,
        '',
        ...(ticket.insisted ? [ '⚠️  O usuário insistiu mesmo com conteúdo já encontrado na plataforma.', '' ] : []),
        'Acesse o painel administrativo para gerenciar este pedido.',
        '',
        '— Sistema de Pedidos Jellyfin'
    ];

    try {
        await transporter.sendMail({
            from,
            to: adminEmail,
            subject,
            text: bodyLines.join('\n')
        });
    } catch (err) {
        console.error('[notifications] Failed to send new-ticket email to admin:', err.message);
    }
}

/**
 * Sends a Discord webhook message announcing newly available content.
 * Only triggered when status becomes 'closed'.
 */
async function sendDiscordAnnouncement(ticket) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const fetch = require('node-fetch');

    const embed = {
        title: `✅ Novo conteúdo disponível: **${ticket.title}**`,
        description: ticket.description,
        color: 0x00c853,
        fields: [
            { name: 'Tipo', value: ticket.type, inline: true },
            ...(ticket.year ? [ { name: 'Ano', value: String(ticket.year), inline: true } ] : [])
        ],
        footer: { text: 'Jellyfin · Sistema de Pedidos' },
        timestamp: new Date().toISOString()
    };

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [ embed ] })
        });
    } catch (err) {
        console.error('[notifications] Failed to send Discord announcement:', err.message);
    }
}

/**
 * Called when a new ticket is created.
 * Notifies the admin; never emails the client at this stage.
 */
async function notifyNewTicket(ticket) {
    await sendAdminNewTicketEmail(ticket);
}

/**
 * Dispatches all relevant notifications for a status change.
 * The client email is resolved from registerDb and gated by the notify_client setting.
 * Call this after persisting the status update to the DB.
 */
async function notifyStatusChange(ticket, newStatus) {
    const tasks = [];

    const notifyClient = getSetting('notify_client') !== 'false';
    if (notifyClient) {
        tasks.push(sendEmailNotification(ticket, newStatus));
    }

    if (newStatus === 'closed') {
        tasks.push(sendDiscordAnnouncement(ticket));
    }

    await Promise.allSettled(tasks);
}

/**
 * Sends an email to the admin notifying of a new content report.
 * Uses the admin_email stored in the settings table.
 */
async function resolveReportUserEmail(report) {
    if (report.user_email) return report.user_email;
    return getEmailByJellyfinId(report.user_id);
}

/**
 * Sends an email to the admin notifying of a new content report.
 * Uses the admin_email stored in the settings table.
 */
async function sendAdminReportEmail(report) {
    const transporter = getTransporter();
    if (!transporter) return;

    const adminEmail = getSetting('admin_email') || process.env.SMTP_ADMIN_EMAIL || process.env.SMTP_USER || '';
    if (!adminEmail) return;

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const subject = `[Problema Reportado] "${report.item_title}"`;

    const webClientUrl = `${process.env.FRONTEND_ORIGIN || 'http://localhost:8080'}/#!/details?id=${report.item_id}`;
    const serverUrl = `${process.env.JELLYFIN_SERVER_URL || 'http://localhost:8096'}/web/index.html#!/details?id=${report.item_id}`;

    const bodyLines = [
        'Um novo problema de conteúdo foi reportado por um usuário.',
        '',
        `Conteúdo: ${report.item_title}`,
        ...(report.item_type ? [ `Tipo: ${report.item_type}` ] : []),
        ...(report.item_year ? [ `Ano: ${report.item_year}` ] : []),
        `Usuário: ${report.user_name} (${report.user_id})`,
        '',
        'Descrição do problema:',
        report.description,
        '',
        'Links diretos para o item:',
        `- Web Client: ${webClientUrl}`,
        `- Servidor Jellyfin: ${serverUrl}`,
        '',
        '— Sistema de Reports Jellyfin'
    ];

    try {
        await transporter.sendMail({
            from,
            to: adminEmail,
            subject,
            text: bodyLines.join('\n')
        });
    } catch (err) {
        console.error('[notifications] Failed to send content report email to admin:', err.message);
    }
}

/**
 * Sends a confirmation email to the user that their content report was received.
 */
async function sendUserReportConfirmationEmail(report) {
    const transporter = getTransporter();
    if (!transporter) return;

    const email = await resolveReportUserEmail(report);
    if (!email) return;

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const subject = `[Reporte de Conteúdo] Recebido: "${report.item_title}"`;

    const bodyLines = [
        `Olá, ${report.user_name}!`,
        '',
        `Confirmamos o recebimento do seu reporte de problema para o conteúdo "${report.item_title}".`,
        '',
        'Descrição relatada:',
        `"${report.description}"`,
        '',
        'Nossa equipe de administração analisará o problema o quanto antes.',
        '',
        'Agradecemos a sua colaboração!',
        '',
        '— Equipe Jellyfin'
    ];

    try {
        await transporter.sendMail({
            from,
            to: email,
            subject,
            text: bodyLines.join('\n')
        });
    } catch (err) {
        console.error('[notifications] Failed to send report confirmation email to user:', err.message);
    }
}

/**
 * Sends an email notification to the user when the status of their report changes.
 */
async function sendUserReportStatusEmail(report) {
    const transporter = getTransporter();
    if (!transporter) return;

    const email = await resolveReportUserEmail(report);
    if (!email) return;

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const isResolved = report.resolved === 1;
    const statusText = isResolved ? 'Resolvido' : 'Reaberto';

    const subject = `[Reporte de Conteúdo] Status atualizado: "${report.item_title}" — ${statusText}`;

    const bodyLines = [
        `Olá, ${report.user_name}!`,
        '',
        `O status do problema relatado para o conteúdo "${report.item_title}" foi atualizado.`,
        '',
        `Status do Reporte: ${statusText}`,
        '',
        isResolved
            ? 'O problema foi resolvido e o conteúdo já deve estar disponível para reprodução normal. Obrigado por nos ajudar a melhorar a plataforma!'
            : 'O problema relatado foi reaberto e continuará sob análise de nossa equipe.',
        '',
        '— Equipe Jellyfin'
    ];

    try {
        await transporter.sendMail({
            from,
            to: email,
            subject,
            text: bodyLines.join('\n')
        });
    } catch (err) {
        console.error('[notifications] Failed to send report status email to user:', err.message);
    }
}

/**
 * Dispatches notifications when a new report is created.
 */
async function notifyContentReport(report) {
    await Promise.allSettled([
        sendAdminReportEmail(report),
        sendUserReportConfirmationEmail(report)
    ]);
}

/**
 * Dispatches notifications when a report's status changes.
 */
async function notifyContentReportStatusChange(report) {
    await sendUserReportStatusEmail(report);
}

module.exports = {
    notifyNewTicket,
    notifyStatusChange,
    sendEmailNotification,
    sendAdminNewTicketEmail,
    sendDiscordAnnouncement,
    notifyContentReport,
    notifyContentReportStatusChange
};

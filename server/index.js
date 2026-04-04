'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const ticketRoutes = require('./routes/tickets');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');

const PORT = parseInt(process.env.TICKET_SERVER_PORT || '3001', 10);

// Detect production mode: when the server is inside a dist/ build, index.html
// exists one level up.  In development it runs from server/ in the repo root,
// where no index.html is present.
const staticDir = path.resolve(__dirname, '..');
const isProduction = fs.existsSync(path.join(staticDir, 'index.html'));

function addOrigin(list, value) {
    if (!value) return;

    for (const rawOrigin of String(value).split(',').map(origin => origin.trim()).filter(Boolean)) {
        try {
            const origin = new URL(rawOrigin).origin;
            list.add(origin);

            const parsed = new URL(origin);
            if (parsed.hostname === 'localhost') {
                list.add(origin.replace('localhost', '127.0.0.1'));
            } else if (parsed.hostname === '127.0.0.1') {
                list.add(origin.replace('127.0.0.1', 'localhost'));
            }
        } catch {
            list.add(rawOrigin);
        }
    }
}

const app = express();

// In production the server IS the origin — no CORS needed.
// In development allow the webpack-dev-server origin.
if (!isProduction) {
    const allowedOrigins = new Set();
    addOrigin(allowedOrigins, process.env.FRONTEND_ORIGIN || 'http://localhost:8080');
    addOrigin(allowedOrigins, process.env.JELLYFIN_SERVER_URL);

    const corsOptions = {
        origin: (origin, cb) => {
            if (!origin || allowedOrigins.has(origin)) return cb(null, true);
            cb(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: false,
        methods: [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS' ],
        allowedHeaders: [ 'Content-Type', 'Authorization', 'X-Emby-Authorization', 'X-Jellyfin-Server' ]
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));
}

app.use(express.json({ limit: '64kb' }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', production: isProduction }));

// API routes — must be registered before the static file middleware so that
// /api/tickets/* is never handled as a static file.
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin/tickets', adminRoutes);
app.use('/api/admin/settings', settingsRoutes);

// Production: serve the compiled frontend and fall back to index.html for
// client-side routes (SPA).
if (isProduction) {
    // Block direct access to the server source directory.
    app.use('/server', (_req, res) => res.status(404).end());

    app.use(express.static(staticDir));

    app.get('*', (_req, res) => {
        res.sendFile(path.join(staticDir, 'index.html'));
    });
}

// Global error handler
app.use((err, _req, res, _next) => {
    console.error('[server]', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    if (isProduction) {
        console.log(`[ticket-server] Production mode — serving frontend + API on http://localhost:${PORT}`);
    } else {
        console.log(`[ticket-server] Development mode — API only on http://localhost:${PORT}`);
    }
});


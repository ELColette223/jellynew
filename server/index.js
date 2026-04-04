'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const ticketRoutes = require('./routes/tickets');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');

const PORT = parseInt(process.env.TICKET_SERVER_PORT || '3001', 10);

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

// Allowed origins: frontend origins plus the Jellyfin server origin for same-host setups.
const allowedOrigins = new Set();
addOrigin(allowedOrigins, process.env.FRONTEND_ORIGIN || 'http://localhost:8080');
addOrigin(allowedOrigins, process.env.JELLYFIN_SERVER_URL);

const corsOptions = {
    origin: (origin, cb) => {
        // Allow requests with no origin (e.g. mobile apps, curl) and listed origins.
        if (!origin || allowedOrigins.has(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: false,
    methods: [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS' ],
    allowedHeaders: [ 'Content-Type', 'Authorization', 'X-Emby-Authorization' ]
};

const app = express();

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '64kb' }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/tickets', ticketRoutes);
app.use('/api/admin/tickets', adminRoutes);
app.use('/api/admin/settings', settingsRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
    console.error('[server]', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`[ticket-server] Listening on http://localhost:${PORT}`);
});

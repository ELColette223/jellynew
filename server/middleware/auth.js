'use strict';

const fetch = require('node-fetch');

const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;

/**
 * Validates a Jellyfin auth token and returns the user object.
 * Returns null if the token is invalid.
 * @param {string} token - MediaBrowser token from Authorization header
 * @returns {Promise<object|null>}
 */
async function validateToken(token) {
    if (!token || !JELLYFIN_URL) return null;

    try {
        const res = await fetch(`${JELLYFIN_URL}/Users/Me`, {
            headers: { Authorization: token },
            timeout: 5000
        });

        if (!res.ok) return null;

        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Express middleware that requires a valid Jellyfin user token.
 * Attaches req.jellyfinUser with the user object.
 */
async function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-emby-authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header missing' });
    }

    const user = await validateToken(authHeader);
    if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.jellyfinUser = user;
    next();
}

/**
 * Express middleware that requires the Jellyfin user to be an admin.
 */
async function requireAdmin(req, res, next) {
    await requireAuth(req, res, async () => {
        if (!req.jellyfinUser?.Policy?.IsAdministrator) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    });
}

module.exports = { requireAuth, requireAdmin, validateToken };

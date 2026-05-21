'use strict';

const fetch = require('node-fetch');

const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;

/**
 * Resolves the effective Jellyfin server URL.
 * Uses the env var when set (production); otherwise falls back to the URL
 * supplied by the client via the X-Jellyfin-Server header (development /
 * zero-config mode).
 *
 * @param {import('express').Request|null} req
 * @returns {string|null}
 */
function resolveJellyfinUrl(req = null) {
    if (JELLYFIN_URL) return JELLYFIN_URL;
    if (req) {
        const fromHeader = req.headers['x-jellyfin-server'];
        if (fromHeader && typeof fromHeader === 'string') return fromHeader.trim();
    }
    return null;
}

/**
 * Validates a Jellyfin auth token and returns the user object.
 * Returns null if the token is invalid.
 * @param {string} token - MediaBrowser token from Authorization header
 * @param {string|null} jellyfinUrl - Override URL (falls back to env var)
 * @returns {Promise<object|null>}
 */
async function validateToken(token, jellyfinUrl = null) {
    const url = jellyfinUrl || JELLYFIN_URL;
    if (!token || !url) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
        const res = await fetch(`${url}/Users/Me`, {
            headers: { Authorization: token },
            signal: controller.signal
        });

        if (!res.ok) return null;

        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Express middleware that requires a valid Jellyfin user token.
 * Attaches req.jellyfinUser with the user object and req.jellyfinServerUrl
 * with the resolved Jellyfin server URL for downstream use.
 */
async function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-emby-authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header missing' });
    }

    const jellyfinServerUrl = resolveJellyfinUrl(req);
    const user = await validateToken(authHeader, jellyfinServerUrl);
    if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.jellyfinUser = user;
    req.jellyfinServerUrl = jellyfinServerUrl;
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

module.exports = { requireAuth, requireAdmin, validateToken, resolveJellyfinUrl };

'use strict';

/**
 * Resolves a Jellyfin user's email address by calling the jellyfin-register
 * internal API endpoint.
 *
 * Configure via .env:
 *   REGISTER_API_URL    – base URL of the jellyfin-register service
 *                         e.g. http://localhost/jellyfin-register
 *   REGISTER_API_SECRET – must match INTERNAL_API_SECRET in the PHP .env
 *
 * If either variable is absent the lookup is skipped and null is returned,
 * so the ticket system continues to work without the register service.
 */

const fetch = require('node-fetch');

/**
 * Look up a user's email by their Jellyfin UUID via the register service API.
 *
 * @param {string} jellyfinUserId
 * @returns {Promise<string|null>}  email address, or null if not found / not configured
 */
async function getEmailByJellyfinId(jellyfinUserId) {
    const baseUrl = (process.env.REGISTER_API_URL || '').trim().replace(/\/$/, '');
    const secret  = (process.env.REGISTER_API_SECRET || '').trim();

    if (!baseUrl || !secret) return null;
    if (!jellyfinUserId)     return null;

    const url = `${baseUrl}/api/user-email?jellyfin_id=${encodeURIComponent(jellyfinUserId)}`;

    try {
        const res = await fetch(url, {
            headers: { 'X-Internal-Secret': secret },
            // Short timeout – this is a background lookup; don't block the request
            timeout: 5000
        });

        if (res.status === 404) return null; // user not in register DB
        if (!res.ok) {
            console.warn(`[userLookup] Register API returned ${res.status} for user ${jellyfinUserId}`);
            return null;
        }

        const data = await res.json();
        return data.email || null;
    } catch (err) {
        // Network errors, timeouts – degrade gracefully
        console.warn('[userLookup] Could not reach register service:', err.message);
        return null;
    }
}

module.exports = { getEmailByJellyfinId };

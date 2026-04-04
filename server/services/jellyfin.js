'use strict';

const fetch = require('node-fetch');

const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;

async function getSystemInfoPublic(jellyfinUrl = null) {
    const url = jellyfinUrl || JELLYFIN_URL;
    if (!url) return null;
    try {
        const res = await fetch(`${url}/System/Info/Public`, { timeout: 8000 });
        if (!res.ok) return null;
        const data = await res.json();
        return data;
    } catch {
        return null;
    }
}

/**
 * Searches the Jellyfin library for matching content.
 * @param {string} token - MediaBrowser auth token
 * @param {string} query - Title to search for
 * @param {number|null} year - Optional release year filter
 * @param {string|null} jellyfinUrl - Override URL (falls back to env var)
 * @returns {Promise<Array>} Array of matching items
 */
async function searchContent(token, query, year = null, jellyfinUrl = null) {
    const url = jellyfinUrl || JELLYFIN_URL;
    if (!url || !token || !query) return [];

    try {
        const params = new URLSearchParams({
            searchTerm: query,
            includeItemTypes: 'Movie,Series,MusicAlbum,Book',
            recursive: 'true',
            limit: '10',
            fields: 'ProviderIds,ProductionYear,Overview'
        });

        if (year) params.set('years', String(year));

        const res = await fetch(`${url}/Items?${params}`, {
            headers: { Authorization: token },
            timeout: 8000
        });

        if (!res.ok) return [];

        const data = await res.json();
        return data.Items || [];
    } catch {
        return [];
    }
}

module.exports = { searchContent, getSystemInfoPublic };

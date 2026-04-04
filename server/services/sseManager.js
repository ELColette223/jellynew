'use strict';

/**
 * In-memory registry of active SSE response streams, keyed by Jellyfin user ID.
 * Each user can hold multiple concurrent connections (multiple tabs).
 *
 * @type {Map<string, Set<import('express').Response>>}
 */
const connections = new Map();

/**
 * Register an SSE response stream for a user.
 * @param {string} userId
 * @param {import('express').Response} res
 */
function addConnection(userId, res) {
    if (!connections.has(userId)) {
        connections.set(userId, new Set());
    }
    connections.get(userId).add(res);
}

/**
 * Remove an SSE response stream (called when the client disconnects).
 * @param {string} userId
 * @param {import('express').Response} res
 */
function removeConnection(userId, res) {
    const set = connections.get(userId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) connections.delete(userId);
}

/**
 * Push a named SSE event to all connections belonging to a user.
 * @param {string} userId
 * @param {string} eventName
 * @param {object} data
 */
function emitToUser(userId, eventName, data) {
    const set = connections.get(userId);
    if (!set || set.size === 0) return;
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
        try {
            res.write(payload);
        } catch {
            // Connection may already be closed; cleaned up on the 'close' event.
        }
    }
}

module.exports = { addConnection, removeConnection, emitToUser };

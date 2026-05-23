'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.TICKET_DB_PATH || path.join(__dirname, '..', 'data', 'tickets.db');

// Ensure the data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema migration
db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT    NOT NULL,
        user_name   TEXT    NOT NULL,
        user_email  TEXT,
        title       TEXT    NOT NULL,
        type        TEXT    NOT NULL DEFAULT 'other',
        description TEXT    NOT NULL,
        year        INTEGER,
        tmdb_id     TEXT,
        imdb_id     TEXT,
        insisted    INTEGER NOT NULL DEFAULT 0,
        status      TEXT    NOT NULL DEFAULT 'open',
        admin_notes TEXT,
        created_at  DATETIME DEFAULT (datetime('now')),
        updated_at  DATETIME DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets (user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status  ON tickets (status);

    CREATE TABLE IF NOT EXISTS ticket_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        old_status  TEXT,
        new_status  TEXT    NOT NULL,
        changed_by  TEXT    NOT NULL,
        note        TEXT,
        created_at  DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_reports (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      TEXT NOT NULL,
        user_name    TEXT NOT NULL,
        user_email   TEXT,
        item_id      TEXT NOT NULL,
        item_title   TEXT NOT NULL,
        item_type    TEXT,
        item_year    INTEGER,
        description  TEXT NOT NULL,
        resolved     INTEGER NOT NULL DEFAULT 0,
        created_at   DATETIME DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reports_created ON content_reports (created_at DESC);

    CREATE TABLE IF NOT EXISTS watch_later (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT    NOT NULL,
        item_id    TEXT    NOT NULL,
        item_title TEXT    NOT NULL,
        item_type  TEXT,
        item_year  INTEGER,
        added_at   DATETIME DEFAULT (datetime('now')),
        UNIQUE(user_id, item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_watch_later_user ON watch_later (user_id);
`);

// Safe migration for existing DBs
try {
    db.exec("ALTER TABLE content_reports ADD COLUMN user_email TEXT;");
} catch (err) {
    // Ignore if column already exists
}

// Seed default settings if not present
const seedSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
seedSetting.run('admin_email', '');
seedSetting.run('notify_client', 'true');

module.exports = db;

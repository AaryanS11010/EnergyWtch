-- EnergyWatch Database Schema
-- SQLite — created automatically by app.py on first run
-- You can also run this file directly:  sqlite3 energywatch.db < schema.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────
-- Users
-- Stores verified accounts with hashed passwords (Werkzeug pbkdf2:sha256)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT UNIQUE NOT NULL,        -- must be @gmail.com for verification
    password_hash   TEXT NOT NULL,               -- pbkdf2:sha256 via werkzeug
    name            TEXT,
    verified        INTEGER DEFAULT 0,           -- 0 = unverified, 1 = verified
    zip_code        TEXT,
    latitude        REAL,
    longitude       REAL,
    location_label  TEXT,                        -- e.g. "Columbus, OH"
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- Email verification codes
-- Codes are hashed before storage; raw code only exists in the email
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    code_hash   TEXT NOT NULL,                   -- pbkdf2:sha256 of the 6-digit code
    expires_at  TEXT NOT NULL,                   -- ISO-8601 UTC
    used        INTEGER DEFAULT 0,               -- 1 = consumed
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- Notifications
-- AI decisions, advisories, alerts.
-- prev_state / new_state store JSON so users can revert AI changes.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    type        TEXT NOT NULL,                   -- 'advisory' | 'decision' | 'alert' | 'info'
    title       TEXT NOT NULL,
    body        TEXT,
    action      TEXT,                            -- 'SELL' | 'BUY' | 'CHARGE' | 'REVERT' etc.
    prev_state  TEXT,                            -- JSON snapshot before AI change
    new_state   TEXT,                            -- JSON snapshot after AI change
    reverted    INTEGER DEFAULT 0,               -- 1 = user reverted this change
    read        INTEGER DEFAULT 0,               -- 1 = user has seen it
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_codes_user ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);

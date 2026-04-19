-- EnergyWatch Database Schema
-- SQLite — created automatically by server.js on first run.
-- You can also inspect or seed it directly:
--   sqlite3 energywatch.db < schema.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────
-- Users
-- Passwords stored as bcrypt hashes (12 rounds via bcrypt npm package)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT UNIQUE NOT NULL,        -- must be @gmail.com for email verification
    password_hash   TEXT NOT NULL,               -- bcrypt, 12 rounds
    name            TEXT,
    verified        INTEGER DEFAULT 0,           -- 0 = pending, 1 = verified
    zip_code        TEXT,
    latitude        REAL,
    longitude       REAL,
    location_label  TEXT,                        -- e.g. "Columbus, OH"
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- Email verification codes
-- The raw 6-digit code is only ever sent via email.
-- Only its bcrypt hash is stored here.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    code_hash   TEXT NOT NULL,                   -- bcrypt hash of the 6-digit code
    expires_at  TEXT NOT NULL,                   -- ISO-8601 UTC, 10-minute window
    used        INTEGER DEFAULT 0,               -- 1 = already consumed
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- Notifications
-- Every AI decision is logged here.
-- prev_state / new_state are JSON blobs so users can revert AI changes.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    type        TEXT NOT NULL,    -- 'advisory' | 'decision' | 'alert' | 'info'
    title       TEXT NOT NULL,
    body        TEXT,
    action      TEXT,             -- 'SELL' | 'BUY' | 'CHARGE' | 'REVERT' | 'PRE_CHARGE' etc.
    prev_state  TEXT,             -- JSON snapshot of state before the AI change
    new_state   TEXT,             -- JSON snapshot of state after the AI change
    reverted    INTEGER DEFAULT 0,-- 1 = user has reverted this change
    read        INTEGER DEFAULT 0,-- 1 = user has seen this notification
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_codes_user ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);

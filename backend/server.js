/**
 * EnergyWatch Backend — IGS Hackathon 2026
 * Node.js + Express + SQLite + bcrypt + JWT + nodemailer (Gmail SMTP)
 *
 * SETUP:
 *   1. npm install
 *   2. Copy .env.example -> .env and fill in your Gmail App Password
 *      (get one at https://myaccount.google.com/apppasswords)
 *   3. node server.js
 *
 * ENDPOINTS:
 *   POST  /api/auth/signup                { email, password, name }  -> sends code
 *   POST  /api/auth/verify                { email, code }            -> activates + JWT
 *   POST  /api/auth/resend                { email }                  -> resends code
 *   POST  /api/auth/signin                { email, password }        -> JWT
 *   GET   /api/me                         (auth)                     -> current user
 *   PUT   /api/me/location                (auth) { zip?, lat?, lon? }
 *   GET   /api/notifications              (auth)
 *   POST  /api/notifications              (auth) { type, title, body, action, prev_state, new_state }
 *   POST  /api/notifications/:id/revert   (auth)
 *   POST  /api/notifications/:id/read     (auth)
 *   POST  /api/notifications/read-all     (auth)
 *   GET   /api/geocode/zip?zip=XXXXX      (free, no key)
 *   GET   /api/weather?lat=&lon=          (Open-Meteo proxy, no key)
 */
 
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();
 
// -------------------------------------------------------------
// CONFIG
// -------------------------------------------------------------
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const BCRYPT_ROUNDS = 12;
const CODE_TTL_MINUTES = 10;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
 
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn('\n⚠️  GMAIL_USER / GMAIL_APP_PASSWORD not set. Verification will log the code to console as a fallback.\n   Real SMTP setup: https://myaccount.google.com/apppasswords\n');
}
 
// -------------------------------------------------------------
// DATABASE (SQLite)
// -------------------------------------------------------------
const db = new Database(path.join(__dirname, 'energywatch.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
 
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    name           TEXT,
    verified       INTEGER DEFAULT 0,
    zip_code       TEXT,
    latitude       REAL,
    longitude      REAL,
    location_label TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );
 
  CREATE TABLE IF NOT EXISTS verification_codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    code_hash   TEXT NOT NULL,
    expires_at  DATETIME NOT NULL,
    used        INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
 
  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    action      TEXT,
    prev_state  TEXT,
    new_state   TEXT,
    reverted    INTEGER DEFAULT 0,
    read        INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
 
  CREATE INDEX IF NOT EXISTS idx_codes_user ON verification_codes(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
`);
 
console.log('✓ SQLite initialized at', path.join(__dirname, 'energywatch.db'));
 
// -------------------------------------------------------------
// MAIL TRANSPORT
// -------------------------------------------------------------
const mailer = (GMAIL_USER && GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
    })
  : null;
 
async function sendVerificationEmail(to, code, name) {
  if (!mailer) {
    console.log(`\n📧 [MOCK — no SMTP creds] Code for ${to}: ${code}\n`);
    return;
  }
 
  const html = `
  <!DOCTYPE html>
  <html><head><meta charset="utf-8"></head>
  <body style="margin:0;padding:40px 20px;background:#f4f7f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:white;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(26,46,37,0.08);">
      <div style="background:linear-gradient(135deg,#1a3329 0%,#0f1f18 100%);padding:40px;text-align:center;">
        <div style="display:inline-block;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#22c55e,#16a34a);line-height:52px;color:white;font-weight:700;font-size:22px;">⚡</div>
        <h1 style="color:#f0fdf4;font-size:28px;margin:20px 0 6px;letter-spacing:-0.02em;">EnergyWatch</h1>
        <p style="color:rgba(240,245,242,0.7);font-size:14px;margin:0;">IGS Energy Hackathon 2026</p>
      </div>
      <div style="padding:40px;">
        <h2 style="color:#1a2e25;font-size:22px;margin:0 0 12px;">Hi ${name || 'there'}, let's verify your email.</h2>
        <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 28px;">
          Enter this 6-digit code in EnergyWatch to finish creating your account. The code expires in ${CODE_TTL_MINUTES} minutes.
        </p>
        <div style="background:linear-gradient(135deg,rgba(34,197,94,0.08),rgba(34,197,94,0.02));border:1.5px dashed rgba(34,197,94,0.3);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
          <div style="font-family:'SF Mono',Monaco,monospace;font-size:38px;font-weight:700;letter-spacing:0.3em;color:#16a34a;">${code}</div>
        </div>
        <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
          If you didn't request this, you can safely ignore it.
        </p>
      </div>
      <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">
          © 2026 EnergyWatch · Built for IGS Energy
        </p>
      </div>
    </div>
  </body></html>`;
 
  await mailer.sendMail({
    from: `"EnergyWatch" <${GMAIL_USER}>`,
    to,
    subject: `Your EnergyWatch verification code: ${code}`,
    text: `Your EnergyWatch verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    html
  });
}
 
// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------
const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
const isValidEmail = e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isGmail = e => isValidEmail(e) && /@gmail\.com$/i.test(e.trim());
const signJwt = uid => jwt.sign({ uid }, JWT_SECRET, { expiresIn: '7d' });
 
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
 
const publicUser = u => ({
  id: u.id, email: u.email, name: u.name, verified: !!u.verified,
  zip_code: u.zip_code, latitude: u.latitude, longitude: u.longitude,
  location_label: u.location_label, created_at: u.created_at
});
 
// -------------------------------------------------------------
// APP
// -------------------------------------------------------------
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
 
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
 
// ----- AUTH -----
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
 
    // Req #6: email + password mandatory
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    // Req #5: must be Gmail
    if (!isGmail(email)) return res.status(400).json({ error: 'A valid Gmail address is required for verification.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
 
    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id, verified FROM users WHERE email = ?').get(normalizedEmail);
    if (existing && existing.verified) return res.status(409).json({ error: 'An account with this email already exists.' });
 
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let userId;
 
    if (existing && !existing.verified) {
      db.prepare('UPDATE users SET password_hash = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(password_hash, name || null, existing.id);
      userId = existing.id;
    } else {
      const info = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
        .run(normalizedEmail, password_hash, name || null);
      userId = info.lastInsertRowid;
    }
 
    const code = generateCode();
    const code_hash = await bcrypt.hash(code, 10);
    const expires_at = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
 
    db.prepare('UPDATE verification_codes SET used = 1 WHERE user_id = ? AND used = 0').run(userId);
    db.prepare('INSERT INTO verification_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)')
      .run(userId, code_hash, expires_at);
 
    try {
      await sendVerificationEmail(normalizedEmail, code, name);
    } catch (e) {
      console.error('Email send failed:', e.message);
      return res.status(500).json({ error: 'Failed to send verification email. Check SMTP config.' });
    }
 
    res.json({
      ok: true,
      message: `Verification code sent to ${normalizedEmail}.`,
      email: normalizedEmail,
      expires_in_minutes: CODE_TTL_MINUTES
    });
  } catch (err) {
    console.error('signup error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});
 
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'Email and code required.' });
 
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found.' });
 
    const row = db.prepare(`
      SELECT * FROM verification_codes
      WHERE user_id = ? AND used = 0
      ORDER BY id DESC LIMIT 1
    `).get(user.id);
 
    if (!row) return res.status(400).json({ error: 'No active verification code. Request a new one.' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
 
    const ok = await bcrypt.compare(String(code), row.code_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid code.' });
 
    db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(row.id);
    db.prepare('UPDATE users SET verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
 
    db.prepare(`INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'info', ?, ?)`)
      .run(user.id, 'Welcome to EnergyWatch', 'Your account is verified. Set your location to start optimizing.');
 
    const token = signJwt(user.id);
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    res.json({ ok: true, token, user: publicUser(fresh) });
  } catch (err) {
    console.error('verify error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});
 
app.post('/api/auth/resend', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required.' });
 
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (user.verified) return res.status(400).json({ error: 'Account already verified.' });
 
    const code = generateCode();
    const code_hash = await bcrypt.hash(code, 10);
    const expires_at = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
 
    db.prepare('UPDATE verification_codes SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);
    db.prepare('INSERT INTO verification_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)')
      .run(user.id, code_hash, expires_at);
 
    await sendVerificationEmail(user.email, code, user.name);
    res.json({ ok: true, message: 'New code sent.', expires_in_minutes: CODE_TTL_MINUTES });
  } catch (err) {
    console.error('resend error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});
 
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
 
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
 
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });
 
    if (!user.verified) {
      return res.status(403).json({
        error: 'Account not verified. Check your email for the code.',
        needs_verification: true,
        email: user.email
      });
    }
 
    const token = signJwt(user.id);
    res.json({ ok: true, token, user: publicUser(user) });
  } catch (err) {
    console.error('signin error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});
 
// ----- USER -----
app.get('/api/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
 
app.put('/api/me/location', requireAuth, (req, res) => {
  const { zip, lat, lon, label } = req.body || {};
  db.prepare(`
    UPDATE users
    SET zip_code = COALESCE(?, zip_code),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        location_label = COALESCE(?, location_label),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(zip || null, lat || null, lon || null, label || null, req.user.id);
 
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ ok: true, user: publicUser(fresh) });
});
 
app.put('/api/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
 
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
 
    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, user.id);
 
    // Email notification
    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
      try {
        const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f4f7f3;border-radius:24px">
          <div style="background:linear-gradient(135deg,#1a3329,#0f1f18);padding:32px;border-radius:16px;text-align:center;margin-bottom:24px">
            <div style="font-size:28px;font-weight:700;color:#f0fdf4">⚡ EnergyWatch</div>
          </div>
          <h2 style="color:#1a2e25">Your password was changed</h2>
          <p style="color:#4b5563;margin:12px 0 24px">Your EnergyWatch account password was successfully updated. If you did not make this change, contact support immediately.</p>
          <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px;color:#dc2626;font-size:13px">
            If this wasn't you, sign in and change your password right away.
          </div>
        </div>`;
        await mailer.sendMail({
          from: `"EnergyWatch" <${GMAIL_USER}>`,
          to: user.email,
          subject: 'Your EnergyWatch password was changed',
          html
        });
      } catch (e) { console.error('Password change email failed:', e.message); }
    }
 
    res.json({ ok: true });
  } catch (err) {
    console.error('password change error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});
 
// ----- NOTIFICATIONS -----
app.get('/api/notifications', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`).all(req.user.id);
  res.json({
    notifications: rows.map(n => ({
      ...n,
      read: !!n.read,
      reverted: !!n.reverted,
      prev_state: n.prev_state ? JSON.parse(n.prev_state) : null,
      new_state: n.new_state ? JSON.parse(n.new_state) : null
    }))
  });
});
 
app.post('/api/notifications', requireAuth, (req, res) => {
  const { type, title, body, action, prev_state, new_state } = req.body || {};
  if (!type || !title) return res.status(400).json({ error: 'type and title required.' });
  const info = db.prepare(`
    INSERT INTO notifications (user_id, type, title, body, action, prev_state, new_state)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, type, title, body || null, action || null,
    prev_state ? JSON.stringify(prev_state) : null,
    new_state ? JSON.stringify(new_state) : null
  );
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
  res.json({ notification: row });
});
 
app.post('/api/notifications/:id/revert', requireAuth, (req, res) => {
  const n = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!n) return res.status(404).json({ error: 'Notification not found.' });
  if (n.reverted) return res.status(400).json({ error: 'Already reverted.' });
  if (!n.prev_state) return res.status(400).json({ error: 'No previous state to revert to.' });
 
  db.prepare('UPDATE notifications SET reverted = 1 WHERE id = ?').run(n.id);
  db.prepare(`INSERT INTO notifications (user_id, type, title, body, action) VALUES (?, 'info', ?, ?, 'REVERT')`)
    .run(req.user.id, `Reverted: ${n.title}`, `System restored to previous state. ${n.body || ''}`.trim());
 
  res.json({ ok: true, reverted_state: JSON.parse(n.prev_state) });
});
 
app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});
 
app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});
 
// ----- GEOCODE + WEATHER -----
app.get('/api/geocode/zip', async (req, res) => {
  const { zip, country = 'US' } = req.query;
  if (!zip) return res.status(400).json({ error: 'zip required' });
  try {
    const r = await fetch(`https://api.zippopotam.us/${country}/${encodeURIComponent(zip)}`);
    if (!r.ok) return res.status(404).json({ error: 'Zip not found.' });
    const data = await r.json();
    const place = data.places?.[0];
    if (!place) return res.status(404).json({ error: 'No place data.' });
    res.json({
      zip,
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
      label: `${place['place name']}, ${place['state abbreviation']}`,
      country: data['country abbreviation']
    });
  } catch {
    res.status(500).json({ error: 'Geocoding failed.' });
  }
});
 
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,shortwave_radiation,is_day` +
      `&hourly=temperature_2m,cloud_cover,shortwave_radiation,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,shortwave_radiation_sum,precipitation_sum` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Open-Meteo: ' + r.status);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error('weather error', e);
    res.status(500).json({ error: 'Weather fetch failed.' });
  }
});
 
// -------------------------------------------------------------
// START
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n⚡ EnergyWatch backend running on http://localhost:${PORT}`);
  console.log(`   Health:   GET  http://localhost:${PORT}/api/health`);
  console.log(`   SMTP:     ${GMAIL_USER ? '✓ ' + GMAIL_USER : '✗ not configured — codes printed to console'}\n`);
});
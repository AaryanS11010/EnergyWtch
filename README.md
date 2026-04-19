# EnergyWatch Backend

Node.js + Express + SQLite backend for the **EnergyWatch** IGS Energy Hackathon project. Handles user accounts with bcrypt-hashed passwords, Gmail-based email verification, JWT sessions, notifications with revert capability, and proxies for Open-Meteo weather + zip-code geocoding.

## Requirements met

| # | Requirement | Implementation |
|---|---|---|
| 1 | Geolocation / zip code for accurate weather | `PUT /api/me/location` + `GET /api/geocode/zip` |
| 2 | Weather aligned with user location | `GET /api/weather?lat=&lon=` proxies Open-Meteo |
| 3 | AI changes in notification center + revert | `notifications` table stores `prev_state`; `POST /api/notifications/:id/revert` restores it |
| 4 | SQL database with hashed passwords | SQLite + bcrypt (12 rounds) |
| 5 | Gmail verification code on signup | 6-digit code, hashed in DB, sent via nodemailer Gmail SMTP |
| 6 | Cannot create account without email + password | Server-side validation rejects missing/invalid email + password |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env from template
cp .env.example .env

# 3. Get a Gmail App Password
#    - Enable 2-Step Verification: https://myaccount.google.com/security
#    - Generate an app password: https://myaccount.google.com/apppasswords
#    - Paste it into .env as GMAIL_APP_PASSWORD

# 4. Run
npm start
```

The server listens on `http://localhost:4000`. SQLite DB file `energywatch.db` is created automatically on first run.

> **No SMTP credentials?** The server will still run — the verification code will be printed to the console instead of being emailed. Useful for local development.

## API reference

### Auth

```
POST /api/auth/signup      { email, password, name }
POST /api/auth/verify      { email, code }
POST /api/auth/resend      { email }
POST /api/auth/signin      { email, password }
```

Signup enforces:
- Email is required, must be a valid Gmail address
- Password is required, min 8 characters
- Password is hashed with bcrypt (12 rounds) before storing
- A 6-digit code is generated, hashed, stored with a 10-minute expiry, and emailed
- The `users.verified` flag stays `0` until the code is entered — unverified accounts **cannot sign in**

### User

```
GET  /api/me                (Bearer JWT)
PUT  /api/me/location       (Bearer JWT)   { zip?, lat?, lon?, label? }
```

### Notifications

```
GET   /api/notifications                   (Bearer JWT)
POST  /api/notifications                   (Bearer JWT)   { type, title, body, action, prev_state, new_state }
POST  /api/notifications/:id/revert        (Bearer JWT)
POST  /api/notifications/:id/read          (Bearer JWT)
POST  /api/notifications/read-all          (Bearer JWT)
```

The AI writes decisions that mutate system state as notifications with a `prev_state` JSON blob. `POST /:id/revert` marks the notification reverted and returns the prior state so the frontend can restore it, then writes a confirmation notification.

### Geocode + Weather (free, no keys)

```
GET /api/geocode/zip?zip=43302              (zippopotam.us)
GET /api/weather?lat=40.59&lon=-83.13       (open-meteo.com)
```

## Schema

```sql
users (id, email UNIQUE, password_hash, name, verified,
       zip_code, latitude, longitude, location_label, created_at, updated_at)

verification_codes (id, user_id, code_hash, expires_at, used, created_at)

notifications (id, user_id, type, title, body, action,
               prev_state, new_state, reverted, read, created_at)
```

Indexes exist on `verification_codes.user_id` and on `notifications(user_id, created_at DESC)`.

## Security notes

- **Passwords**: bcrypt, 12 rounds. Never stored in plaintext, never returned in responses.
- **Verification codes**: bcrypt-hashed before storage (10 rounds). Raw code is only ever sent via email.
- **JWT**: 7-day expiry, signed with `JWT_SECRET` from `.env` (auto-generated random if absent, but set one in prod).
- **CORS**: open by default for dev. In production, restrict the `origin` in `server.js`.
- **Rate limiting**: not implemented here — add `express-rate-limit` on `/api/auth/*` before deploying.

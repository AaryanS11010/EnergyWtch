"""
EnergyWatch Flask Backend — IGS Hackathon 2026
================================================
Run with:
    pip install flask werkzeug pyjwt
    python app.py

The SQLite database (energywatch.db) is created automatically on first run.
No .env file required — everything runs out of the box.

Endpoints
---------
POST  /api/auth/signup          { email, password, name? }
POST  /api/auth/verify          { email, code }
POST  /api/auth/resend          { email }
POST  /api/auth/signin          { email, password }
GET   /api/me                   (Bearer JWT)
PUT   /api/me/location          (Bearer JWT) { lat, lon, label?, zip? }
GET   /api/notifications        (Bearer JWT)
POST  /api/notifications        (Bearer JWT) { type, title, body?, action?, prev_state?, new_state? }
POST  /api/notifications/<id>/revert   (Bearer JWT)
POST  /api/notifications/<id>/read     (Bearer JWT)
POST  /api/notifications/read-all      (Bearer JWT)
GET   /api/geocode/zip?zip=XXXXX
GET   /api/weather?lat=&lon=
GET   /api/health
"""

import sqlite3
import os
import json
import secrets
import random
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from functools import wraps

from flask import Flask, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
DB_PATH      = os.path.join(os.path.dirname(__file__), "energywatch.db")
JWT_SECRET   = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_DAYS     = 7
CODE_MINUTES = 10
PORT         = int(os.environ.get("PORT", 4000))

app = Flask(__name__)

# ─────────────────────────────────────────────
# CORS — allow the React dev server (any origin)
# ─────────────────────────────────────────────
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

@app.route("/api/<path:p>", methods=["OPTIONS"])
def options_handler(p):
    return jsonify({}), 200


# ─────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db:
        db.close()

def init_db():
    """Create tables on first run."""
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA foreign_keys=ON")
    con.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            email           TEXT UNIQUE NOT NULL,
            password_hash   TEXT NOT NULL,
            name            TEXT,
            verified        INTEGER DEFAULT 0,
            zip_code        TEXT,
            latitude        REAL,
            longitude       REAL,
            location_label  TEXT,
            created_at      TEXT DEFAULT (datetime('now')),
            updated_at      TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS verification_codes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            code_hash   TEXT NOT NULL,
            expires_at  TEXT NOT NULL,
            used        INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now')),
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
            created_at  TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_codes_user ON verification_codes(user_id);
        CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);
    """)
    con.commit()
    con.close()
    print(f"✓ SQLite database ready at {DB_PATH}")


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def is_gmail(email: str) -> bool:
    return isinstance(email, str) and email.strip().lower().endswith("@gmail.com") and "@" in email

def make_jwt(user_id: int) -> str:
    payload = {
        "uid": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def public_user(row) -> dict:
    return {
        "id":             row["id"],
        "email":          row["email"],
        "name":           row["name"],
        "verified":       bool(row["verified"]),
        "zip_code":       row["zip_code"],
        "latitude":       row["latitude"],
        "longitude":      row["longitude"],
        "location_label": row["location_label"],
        "created_at":     row["created_at"],
    }

def serialize_notification(row) -> dict:
    d = dict(row)
    d["read"]       = bool(d["read"])
    d["reverted"]   = bool(d["reverted"])
    d["prev_state"] = json.loads(d["prev_state"]) if d["prev_state"] else None
    d["new_state"]  = json.loads(d["new_state"])  if d["new_state"]  else None
    return d

def err(msg: str, code: int = 400):
    return jsonify({"error": msg}), code

def ok(**kwargs):
    return jsonify({"ok": True, **kwargs})


# ─────────────────────────────────────────────
# AUTH DECORATOR
# ─────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        token  = header[7:] if header.startswith("Bearer ") else None
        if not token:
            return err("Missing auth token", 401)
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return err("Token expired", 401)
        except jwt.InvalidTokenError:
            return err("Invalid token", 401)

        db  = get_db()
        row = db.execute("SELECT * FROM users WHERE id = ?", (payload["uid"],)).fetchone()
        if not row:
            return err("User not found", 401)
        g.current_user = row
        return f(*args, **kwargs)
    return wrapper


# ─────────────────────────────────────────────
# VERIFICATION CODE (Gmail SMTP optional)
# ─────────────────────────────────────────────
def send_or_print_code(to_email: str, code: str, name: str):
    """
    Try Gmail SMTP if GMAIL_USER / GMAIL_APP_PASSWORD are set in env.
    Otherwise just print to console — perfectly fine for a hackathon demo.
    """
    gmail_user = os.environ.get("GMAIL_USER")
    gmail_pass = os.environ.get("GMAIL_APP_PASSWORD")

    if gmail_user and gmail_pass:
        try:
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            html = f"""
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
              <h2 style="color:#1a2e25">Hi {name or 'there'},</h2>
              <p>Your EnergyWatch verification code is:</p>
              <div style="font-size:36px;font-weight:700;letter-spacing:0.4em;color:#16a34a;
                          padding:24px;background:#f0fdf4;border-radius:12px;text-align:center">
                {code}
              </div>
              <p style="color:#6b7280;font-size:13px">Expires in {CODE_MINUTES} minutes.</p>
            </div>"""

            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"EnergyWatch verification code: {code}"
            msg["From"]    = f"EnergyWatch <{gmail_user}>"
            msg["To"]      = to_email
            msg.attach(MIMEText(html, "html"))

            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
                s.login(gmail_user, gmail_pass)
                s.sendmail(gmail_user, to_email, msg.as_string())

            print(f"📧 Verification email sent to {to_email}")
            return
        except Exception as e:
            print(f"⚠️  SMTP failed ({e}), falling back to console")

    # Console fallback — works for demos without SMTP config
    print(f"\n{'='*50}")
    print(f"📧  VERIFICATION CODE for {to_email}")
    print(f"    Code : {code}")
    print(f"    Valid: {CODE_MINUTES} minutes")
    print(f"{'='*50}\n")


# ─────────────────────────────────────────────
# ROUTES — AUTH
# ─────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"ok": True, "time": datetime.now(timezone.utc).isoformat()})


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name     = data.get("name") or ""

    # Requirement #6: email + password mandatory
    if not email:
        return err("Email is required.")
    if not password:
        return err("Password is required.")
    if not is_gmail(email):
        return err("A valid Gmail address is required (e.g. you@gmail.com).")
    if len(password) < 8:
        return err("Password must be at least 8 characters.")

    db = get_db()
    existing = db.execute("SELECT id, verified FROM users WHERE email = ?", (email,)).fetchone()

    if existing and existing["verified"]:
        return err("An account with this email already exists.", 409)

    pw_hash = generate_password_hash(password)

    if existing and not existing["verified"]:
        # Update creds on an unverified account
        db.execute(
            "UPDATE users SET password_hash=?, name=?, updated_at=datetime('now') WHERE id=?",
            (pw_hash, name or None, existing["id"])
        )
        user_id = existing["id"]
    else:
        cur = db.execute(
            "INSERT INTO users (email, password_hash, name) VALUES (?,?,?)",
            (email, pw_hash, name or None)
        )
        user_id = cur.lastrowid

    # Generate 6-digit code and hash it
    code      = str(random.randint(0, 999999)).zfill(6)
    code_hash = generate_password_hash(code)
    expires   = (datetime.now(timezone.utc) + timedelta(minutes=CODE_MINUTES)).isoformat()

    db.execute("UPDATE verification_codes SET used=1 WHERE user_id=? AND used=0", (user_id,))
    db.execute(
        "INSERT INTO verification_codes (user_id, code_hash, expires_at) VALUES (?,?,?)",
        (user_id, code_hash, expires)
    )
    db.commit()

    send_or_print_code(email, code, name)

    return ok(
        message=f"Verification code sent to {email}. Check your inbox (or the server console).",
        email=email,
        expires_in_minutes=CODE_MINUTES
    )


@app.route("/api/auth/verify", methods=["POST"])
def verify():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code  = str(data.get("code") or "").strip()

    if not email or not code:
        return err("Email and code are required.")

    db   = get_db()
    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user:
        return err("Account not found.", 404)

    row = db.execute(
        "SELECT * FROM verification_codes WHERE user_id=? AND used=0 ORDER BY id DESC LIMIT 1",
        (user["id"],)
    ).fetchone()

    if not row:
        return err("No active verification code. Request a new one.")

    # Check expiry
    try:
        exp = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp:
            return err("Code expired. Request a new one.")
    except Exception:
        pass  # malformed date — let it through and rely on hash check

    if not check_password_hash(row["code_hash"], code):
        return err("Invalid code.")

    db.execute("UPDATE verification_codes SET used=1 WHERE id=?", (row["id"],))
    db.execute("UPDATE users SET verified=1, updated_at=datetime('now') WHERE id=?", (user["id"],))
    db.execute(
        "INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)",
        (user["id"], "info", "Welcome to EnergyWatch",
         "Your account is verified. Set your location to start optimizing.")
    )
    db.commit()

    token = make_jwt(user["id"])
    fresh = db.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    return ok(token=token, user=public_user(fresh))


@app.route("/api/auth/resend", methods=["POST"])
def resend():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return err("Email required.")

    db   = get_db()
    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user:
        return err("Account not found.", 404)
    if user["verified"]:
        return err("Account already verified.")

    code      = str(random.randint(0, 999999)).zfill(6)
    code_hash = generate_password_hash(code)
    expires   = (datetime.now(timezone.utc) + timedelta(minutes=CODE_MINUTES)).isoformat()

    db.execute("UPDATE verification_codes SET used=1 WHERE user_id=? AND used=0", (user["id"],))
    db.execute(
        "INSERT INTO verification_codes (user_id, code_hash, expires_at) VALUES (?,?,?)",
        (user["id"], code_hash, expires)
    )
    db.commit()

    send_or_print_code(email, code, user["name"] or "")
    return ok(message="New code sent.", expires_in_minutes=CODE_MINUTES)


@app.route("/api/auth/signin", methods=["POST"])
def signin():
    data     = request.get_json(silent=True) or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return err("Email and password are required.")

    db   = get_db()
    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return err("Invalid credentials.", 401)

    if not user["verified"]:
        return jsonify({
            "error": "Account not verified. Check your email for the code.",
            "needs_verification": True,
            "email": user["email"]
        }), 403

    token = make_jwt(user["id"])
    return ok(token=token, user=public_user(user))


# ─────────────────────────────────────────────
# ROUTES — USER
# ─────────────────────────────────────────────
@app.route("/api/me")
@require_auth
def me():
    return jsonify({"user": public_user(g.current_user)})


@app.route("/api/me/location", methods=["PUT"])
@require_auth
def update_location():
    data  = request.get_json(silent=True) or {}
    uid   = g.current_user["id"]
    db    = get_db()
    db.execute("""
        UPDATE users SET
            zip_code       = COALESCE(?, zip_code),
            latitude       = COALESCE(?, latitude),
            longitude      = COALESCE(?, longitude),
            location_label = COALESCE(?, location_label),
            updated_at     = datetime('now')
        WHERE id = ?
    """, (
        data.get("zip")   or None,
        data.get("lat")   or None,
        data.get("lon")   or None,
        data.get("label") or None,
        uid
    ))
    db.commit()
    fresh = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return ok(user=public_user(fresh))


# ─────────────────────────────────────────────
# ROUTES — NOTIFICATIONS
# ─────────────────────────────────────────────
@app.route("/api/notifications", methods=["GET"])
@require_auth
def get_notifications():
    db   = get_db()
    rows = db.execute(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        (g.current_user["id"],)
    ).fetchall()
    return jsonify({"notifications": [serialize_notification(r) for r in rows]})


@app.route("/api/notifications", methods=["POST"])
@require_auth
def create_notification():
    data = request.get_json(silent=True) or {}
    if not data.get("type") or not data.get("title"):
        return err("type and title are required.")
    db  = get_db()
    cur = db.execute(
        "INSERT INTO notifications (user_id,type,title,body,action,prev_state,new_state) VALUES (?,?,?,?,?,?,?)",
        (
            g.current_user["id"],
            data["type"], data["title"],
            data.get("body")   or None,
            data.get("action") or None,
            json.dumps(data["prev_state"]) if data.get("prev_state") else None,
            json.dumps(data["new_state"])  if data.get("new_state")  else None,
        )
    )
    db.commit()
    row = db.execute("SELECT * FROM notifications WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify({"notification": serialize_notification(row)})


@app.route("/api/notifications/read-all", methods=["POST"])
@require_auth
def read_all():
    db = get_db()
    db.execute("UPDATE notifications SET read=1 WHERE user_id=?", (g.current_user["id"],))
    db.commit()
    return ok()


@app.route("/api/notifications/<int:nid>/revert", methods=["POST"])
@require_auth
def revert_notification(nid):
    db  = get_db()
    row = db.execute(
        "SELECT * FROM notifications WHERE id=? AND user_id=?",
        (nid, g.current_user["id"])
    ).fetchone()
    if not row:
        return err("Notification not found.", 404)
    if row["reverted"]:
        return err("Already reverted.")
    if not row["prev_state"]:
        return err("No previous state to revert to.")

    db.execute("UPDATE notifications SET reverted=1 WHERE id=?", (nid,))
    db.execute(
        "INSERT INTO notifications (user_id,type,title,body,action) VALUES (?,?,?,?,?)",
        (g.current_user["id"], "info", f"Reverted: {row['title']}",
         f"System restored to previous state. {row['body'] or ''}".strip(), "REVERT")
    )
    db.commit()
    return ok(reverted_state=json.loads(row["prev_state"]))


@app.route("/api/notifications/<int:nid>/read", methods=["POST"])
@require_auth
def read_notification(nid):
    db = get_db()
    db.execute(
        "UPDATE notifications SET read=1 WHERE id=? AND user_id=?",
        (nid, g.current_user["id"])
    )
    db.commit()
    return ok()


# ─────────────────────────────────────────────
# ROUTES — GEOCODE + WEATHER (free, no keys)
# ─────────────────────────────────────────────
@app.route("/api/geocode/zip")
def geocode_zip():
    zip_code = request.args.get("zip", "").strip()
    country  = request.args.get("country", "US")
    if not zip_code:
        return err("zip parameter required.")
    try:
        url = f"https://api.zippopotam.us/{country}/{urllib.parse.quote(zip_code)}"
        req = urllib.request.Request(url, headers={"User-Agent": "EnergyWatch/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        place = data["places"][0]
        return jsonify({
            "zip":     zip_code,
            "lat":     float(place["latitude"]),
            "lon":     float(place["longitude"]),
            "label":   f"{place['place name']}, {place['state abbreviation']}",
            "country": data["country abbreviation"],
        })
    except urllib.error.HTTPError as e:
        return err("Zip code not found.", 404)
    except Exception as e:
        return err(f"Geocoding failed: {e}", 500)


@app.route("/api/weather")
def weather():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    if not lat or not lon:
        return err("lat and lon required.")
    try:
        params = (
            f"latitude={lat}&longitude={lon}"
            "&current=temperature_2m,apparent_temperature,relative_humidity_2m,"
            "weather_code,cloud_cover,wind_speed_10m,shortwave_radiation,is_day"
            "&hourly=temperature_2m,cloud_cover,shortwave_radiation,weather_code,precipitation_probability"
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,"
            "shortwave_radiation_sum,precipitation_sum"
            "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7"
        )
        url = f"https://api.open-meteo.com/v1/forecast?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "EnergyWatch/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        return jsonify(data)
    except Exception as e:
        return err(f"Weather fetch failed: {e}", 500)


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    print(f"\n⚡ EnergyWatch Flask backend")
    print(f"   http://localhost:{PORT}/api/health")
    print(f"   Database: {DB_PATH}")
    print(f"   Gmail SMTP: {'configured' if os.environ.get('GMAIL_USER') else 'not set — codes print to console'}\n")
    app.run(host="0.0.0.0", port=PORT, debug=False)

"""Smart Baggage Tracking Portal - Flask API (SQLite storage)."""
import os
import socket
import sqlite3
import uuid
from datetime import datetime, timezone

from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE, "baggage.db"))
DIST = os.environ.get("FRONTEND_DIST", os.path.join(BASE, "..", "frontend", "dist"))
APP_VERSION = os.environ.get("APP_VERSION", "dev")

STATUSES = ["Checked In", "Security Screening", "Loaded on Aircraft", "In Transit",
            "Arrived", "On Carousel", "Delivered", "Missing"]
LF_STATUSES = ["Found", "Under Review", "Claimed", "Disposed"]

app = Flask(__name__, static_folder=None)
CORS(app)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_):
    d = g.pop("db", None)
    if d:
        d.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS baggage(
  tag TEXT PRIMARY KEY, passenger TEXT, flight TEXT, origin TEXT, destination TEXT,
  status TEXT, location TEXT, carousel TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT, status TEXT, location TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS reports(
  id TEXT PRIMARY KEY, tag TEXT, passenger TEXT, email TEXT, phone TEXT, flight TEXT,
  description TEXT, status TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS lostfound(
  id TEXT PRIMARY KEY, item TEXT, description TEXT, found_at TEXT, status TEXT,
  matched_report TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS flights(
  flight TEXT PRIMARY KEY, destination TEXT, carousel TEXT, eta TEXT, status TEXT);
"""


def init_db():
    c = sqlite3.connect(DB_PATH)
    c.executescript(SCHEMA)
    if c.execute("SELECT COUNT(*) FROM baggage").fetchone()[0] == 0:
        seed(c)
    c.commit()
    c.close()


def seed(c):
    bags = [
        ("BG100001", "Anita Rao", "AI101", "Hyderabad", "Delhi", "On Carousel", "Delhi T3 Carousel 4", "4"),
        ("BG100002", "Ravi Kumar", "6E202", "Mumbai", "Bengaluru", "In Transit", "Mumbai Apron", ""),
        ("BG100003", "Meera Shah", "UK303", "Delhi", "Hyderabad", "Security Screening", "Delhi T3 Screening", ""),
        ("BG100004", "John Paul", "AI404", "Chennai", "Kolkata", "Missing", "Unknown", ""),
    ]
    for t, p, f, o, d, s, loc, car in bags:
        c.execute("INSERT INTO baggage VALUES(?,?,?,?,?,?,?,?,?)", (t, p, f, o, d, s, loc, car, now()))
        c.execute("INSERT INTO events(tag,status,location,at) VALUES(?,?,?,?)", (t, "Checked In", o, now()))
        c.execute("INSERT INTO events(tag,status,location,at) VALUES(?,?,?,?)", (t, s, loc, now()))
    for f in [("AI101", "Delhi", "4", "10:45", "Landed"), ("6E202", "Bengaluru", "2", "12:10", "In Air"),
              ("UK303", "Hyderabad", "6", "14:30", "Scheduled"), ("AI404", "Kolkata", "1", "16:05", "Landed")]:
        c.execute("INSERT INTO flights VALUES(?,?,?,?,?)", f)
    c.execute("INSERT INTO lostfound VALUES(?,?,?,?,?,?,?)",
              ("LF-1001", "Black cabin trolley", "Black hard-shell, red ribbon on handle",
               "Delhi T3 Arrivals", "Found", None, now()))


def rows(q, a=()):
    return [dict(r) for r in db().execute(q, a).fetchall()]


def err(msg, code=400):
    return jsonify(error=msg), code


@app.get("/health")
@app.get("/api/health")
def health():
    try:
        db().execute("SELECT 1")
        ok, detail = True, "SQLite storage OK"
    except Exception as e:  # pragma: no cover
        ok, detail = False, str(e)
    return jsonify(version=APP_VERSION, pod=os.environ.get("HOSTNAME", socket.gethostname()),
                   db={"connected": ok, "detail": detail})


@app.get("/api/meta")
def meta():
    return jsonify(statuses=STATUSES, lf_statuses=LF_STATUSES)


@app.get("/api/stats")
def stats():
    s = {r["status"]: r["n"] for r in rows("SELECT status, COUNT(*) n FROM baggage GROUP BY status")}
    return jsonify(
        total=sum(s.values()), by_status=s,
        open_reports=rows("SELECT COUNT(*) n FROM reports WHERE status!='Resolved'")[0]["n"],
        lost_found=rows("SELECT COUNT(*) n FROM lostfound WHERE status IN ('Found','Under Review')")[0]["n"])


# ---- baggage tracking ----
@app.get("/api/baggage")
def list_baggage():
    return jsonify(rows("SELECT * FROM baggage ORDER BY updated_at DESC"))


@app.get("/api/baggage/<tag>")
def track(tag):
    b = rows("SELECT * FROM baggage WHERE tag=?", (tag.upper().strip(),))
    if not b:
        return err("No baggage found with that tag number", 404)
    ev = rows("SELECT status,location,at FROM events WHERE tag=? ORDER BY id", (b[0]["tag"],))
    return jsonify(bag=b[0], events=ev)


@app.post("/api/baggage")
def add_baggage():
    d = request.get_json(silent=True) or {}
    for k in ("passenger", "flight", "origin", "destination"):
        if not str(d.get(k, "")).strip():
            return err(f"{k} is required")
    tag = "BG" + uuid.uuid4().hex[:6].upper()
    db().execute("INSERT INTO baggage VALUES(?,?,?,?,?,?,?,?,?)",
                 (tag, d["passenger"].strip(), d["flight"].strip().upper(), d["origin"].strip(),
                  d["destination"].strip(), "Checked In", d["origin"].strip(), "", now()))
    db().execute("INSERT INTO events(tag,status,location,at) VALUES(?,?,?,?)",
                 (tag, "Checked In", d["origin"].strip(), now()))
    db().commit()
    return jsonify(tag=tag), 201


@app.patch("/api/baggage/<tag>")
def update_baggage(tag):
    d = request.get_json(silent=True) or {}
    if d.get("status") not in STATUSES:
        return err("invalid status")
    loc = str(d.get("location", "")).strip() or "Unknown"
    cur = db().execute("UPDATE baggage SET status=?, location=?, carousel=COALESCE(NULLIF(?, ''), carousel), "
                       "updated_at=? WHERE tag=?", (d["status"], loc, d.get("carousel", ""), now(), tag))
    if cur.rowcount == 0:
        return err("not found", 404)
    db().execute("INSERT INTO events(tag,status,location,at) VALUES(?,?,?,?)", (tag, d["status"], loc, now()))
    db().commit()
    return jsonify(ok=True)


# ---- missing baggage reports ----
@app.post("/api/reports")
def create_report():
    d = request.get_json(silent=True) or {}
    for k in ("passenger", "email", "flight", "description"):
        if not str(d.get(k, "")).strip():
            return err(f"{k} is required")
    if "@" not in d["email"]:
        return err("enter a valid email")
    rid = "PIR-" + uuid.uuid4().hex[:6].upper()
    tag = str(d.get("tag", "")).upper().strip()
    db().execute("INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)",
                 (rid, tag, d["passenger"].strip(), d["email"].strip(), d.get("phone", "").strip(),
                  d["flight"].strip().upper(), d["description"].strip(), "Open", now()))
    if tag:
        db().execute("UPDATE baggage SET status='Missing', updated_at=? WHERE tag=?", (now(), tag))
        db().execute("INSERT INTO events(tag,status,location,at) VALUES(?,?,?,?)",
                     (tag, "Missing", "Reported by passenger", now()))
    db().commit()
    return jsonify(id=rid), 201


@app.get("/api/reports")
def list_reports():
    return jsonify(rows("SELECT * FROM reports ORDER BY created_at DESC"))


@app.get("/api/reports/<rid>")
def get_report(rid):
    r = rows("SELECT id,tag,flight,status,created_at FROM reports WHERE id=?", (rid.upper().strip(),))
    return (jsonify(r[0]) if r else err("report not found", 404))


@app.patch("/api/reports/<rid>")
def update_report(rid):
    st = (request.get_json(silent=True) or {}).get("status")
    if st not in ("Open", "Searching", "Resolved"):
        return err("invalid status")
    cur = db().execute("UPDATE reports SET status=? WHERE id=?", (st, rid))
    db().commit()
    return jsonify(ok=True) if cur.rowcount else err("not found", 404)


# ---- claim information ----
@app.get("/api/claim")
def claim_info():
    return jsonify(
        flights=rows("SELECT * FROM flights ORDER BY eta"),
        steps=["Go to the carousel shown for your flight.",
               "Match your tag number (BGxxxxxx) with the tag on the bag.",
               "Keep your boarding pass and baggage receipt ready for verification.",
               "If your bag has not arrived within 45 minutes, report it from the Report Missing page.",
               "Damaged bag? Report before leaving the airport."],
        contact={"desk": "Baggage Services Desk, Arrivals Hall", "phone": "+91 00000 00000",
                 "email": "baggage@example.com", "hours": "24 hours"})


# ---- lost & found ----
@app.get("/api/lostfound")
def list_lf():
    q = request.args.get("q", "").strip()
    if q:
        like = f"%{q}%"
        return jsonify(rows("SELECT * FROM lostfound WHERE item LIKE ? OR description LIKE ? OR found_at LIKE ? "
                            "ORDER BY created_at DESC", (like, like, like)))
    return jsonify(rows("SELECT * FROM lostfound ORDER BY created_at DESC"))


@app.post("/api/lostfound")
def add_lf():
    d = request.get_json(silent=True) or {}
    for k in ("item", "description", "found_at"):
        if not str(d.get(k, "")).strip():
            return err(f"{k} is required")
    lid = "LF-" + uuid.uuid4().hex[:4].upper()
    db().execute("INSERT INTO lostfound VALUES(?,?,?,?,?,?,?)",
                 (lid, d["item"].strip(), d["description"].strip(), d["found_at"].strip(), "Found", None, now()))
    db().commit()
    return jsonify(id=lid), 201


@app.patch("/api/lostfound/<lid>")
def update_lf(lid):
    d = request.get_json(silent=True) or {}
    if d.get("status") not in LF_STATUSES:
        return err("invalid status")
    cur = db().execute("UPDATE lostfound SET status=?, matched_report=COALESCE(NULLIF(?, ''), matched_report) "
                       "WHERE id=?", (d["status"], d.get("matched_report", ""), lid))
    db().commit()
    return jsonify(ok=True) if cur.rowcount else err("not found", 404)


# ---- serve React build ----
@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def spa(path):
    if path.startswith("api/"):
        return err("not found", 404)
    full = os.path.join(DIST, path)
    if path and os.path.isfile(full):
        return send_from_directory(DIST, path)
    if os.path.isfile(os.path.join(DIST, "index.html")):
        return send_from_directory(DIST, "index.html")
    return "Frontend not built. Run: cd frontend && npm install && npm run build", 200


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), debug=False)  # nosemgrep
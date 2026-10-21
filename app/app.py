import os
import socket
from datetime import datetime

from flask import Flask, jsonify, redirect, render_template, request, url_for

app = Flask(__name__)

APP_VERSION = os.getenv("APP_VERSION", "dev")
POD_NAME = os.getenv("HOSTNAME", socket.gethostname())

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME", "pocdb")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT", "5432")

# Fallback in-memory store so the site still works without a database
_memory_messages = []


def get_conn():
    """Return a Postgres connection (Azure Database for PostgreSQL) or None."""
    if not DB_HOST:
        return None
    import psycopg2

    return psycopg2.connect(
        host=DB_HOST,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT,
        sslmode=os.getenv("DB_SSLMODE", "require"),
        connect_timeout=3,
    )


def init_db():
    try:
        conn = get_conn()
        if conn is None:
            return
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    text TEXT NOT NULL,
                    pod TEXT,
                    version TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
        conn.close()
    except Exception as exc:  # noqa: BLE001
        print(f"DB init failed: {exc}")


def db_status():
    if not DB_HOST:
        return {"connected": False, "detail": "DB_HOST not set (using in-memory store)"}
    try:
        conn = get_conn()
        conn.close()
        return {"connected": True, "detail": f"Connected to {DB_HOST}"}
    except Exception as exc:  # noqa: BLE001
        return {"connected": False, "detail": str(exc)[:120]}


def fetch_messages():
    try:
        conn = get_conn()
        if conn is None:
            return list(reversed(_memory_messages))[:20]
        with conn, conn.cursor() as cur:
            cur.execute(
                "SELECT name, text, pod, version, created_at "
                "FROM messages ORDER BY id DESC LIMIT 20"
            )
            rows = cur.fetchall()
        conn.close()
        return [
            {"name": r[0], "text": r[1], "pod": r[2], "version": r[3],
             "created_at": r[4].strftime("%Y-%m-%d %H:%M:%S")}
            for r in rows
        ]
    except Exception:  # noqa: BLE001
        return []


def save_message(name, text):
    try:
        conn = get_conn()
        if conn is None:
            _memory_messages.append({
                "name": name, "text": text, "pod": POD_NAME, "version": APP_VERSION,
                "created_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            })
            return
        with conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO messages (name, text, pod, version) VALUES (%s, %s, %s, %s)",
                (name, text, POD_NAME, APP_VERSION),
            )
        conn.close()
    except Exception as exc:  # noqa: BLE001
        print(f"Save failed: {exc}")


@app.route("/")
def index():
    return render_template(
        "index.html",
        version=APP_VERSION,
        pod=POD_NAME,
        db=db_status(),
        messages=fetch_messages(),
    )


@app.route("/message", methods=["POST"])
def message():
    name = request.form.get("name", "").strip()[:50] or "Anonymous"
    text = request.form.get("text", "").strip()[:300]
    if text:
        save_message(name, text)
    return redirect(url_for("index"))


@app.route("/health")
def health():
    return jsonify(status="ok")


@app.route("/api/info")
def info():
    return jsonify(version=APP_VERSION, pod=POD_NAME, db=db_status())


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))

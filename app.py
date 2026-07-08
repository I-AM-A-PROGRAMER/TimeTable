"""
KIIT Timetable web app — Flask backend.

- Serves a JSON API over the SQLite database produced by build_db.py.
- Serves the frontend (frontend/) so the app works fully locally.
- Enables CORS so the same frontend can be hosted separately on Vercel.

Run locally:
    python build_db.py     # build the database from the Excel (one-time / on changes)
    python app.py          # start the server
Then open http://127.0.0.1:5000
"""
import os
import sqlite3
from collections import defaultdict

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "timetable.db")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app = Flask(__name__, static_folder=None)
# Allow the Vercel-hosted frontend to call this API.
CORS(app, resources={r"/api/*": {"origins": "*"}})


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #
@app.route("/api/sections")
def api_sections():
    """List all sections, grouped by department (for the dropdown filter)."""
    db = get_db()
    rows = db.execute(
        "SELECT code, department, semester FROM sections ORDER BY department, code"
    ).fetchall()
    db.close()

    grouped = defaultdict(list)
    for r in rows:
        grouped[r["department"]].append(
            {"code": r["code"], "semester": r["semester"]}
        )
    return jsonify(grouped)


@app.route("/api/timetable")
def api_timetable():
    """
    Returns the full week for a section.
    Query: ?section=CS1
    """
    section = (request.args.get("section") or "").strip()
    if not section:
        return jsonify({"error": "section parameter required"}), 400

    db = get_db()
    sec = db.execute("SELECT * FROM sections WHERE code=?", (section,)).fetchone()
    if not sec:
        return jsonify({"error": "unknown section"}), 404

    rows = db.execute(
        """
        SELECT c.day, p.id AS period_id, p.name AS period, p.start_time, p.end_time,
               c.subject, c.teacher, c.room
        FROM classes c
        JOIN periods p ON c.period_id = p.id
        WHERE c.section_id = ?
        ORDER BY c.day, p.id
        """,
        (sec["id"],),
    ).fetchall()
    db.close()

    days = defaultdict(list)
    for r in rows:
        days[r["day"]].append(
            {
                "period": r["period"],
                "start": r["start_time"],
                "end": r["end_time"],
                "subject": r["subject"],
                "teacher": r["teacher"],
                "room": r["room"],
            }
        )

    return jsonify(
        {
            "section": sec["code"],
            "department": sec["department"],
            "semester": sec["semester"],
            "days": days,
        }
    )


@app.route("/api/health")
def api_health():
    return jsonify({"ok": True})


# --------------------------------------------------------------------------- #
# Frontend (local mode). On Vercel these files are served statically instead.
# --------------------------------------------------------------------------- #
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("Database not found. Run: python build_db.py")
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))

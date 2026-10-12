import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(os.getenv("JEWELRYAI_DATA_DIR", str(Path(__file__).resolve().parents[1] / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "studio.sqlite3"

def connect():
    db = sqlite3.connect(DB_PATH, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("CREATE TABLE IF NOT EXISTS versions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_id TEXT, number INTEGER NOT NULL, label TEXT NOT NULL, prompt TEXT NOT NULL, engine TEXT NOT NULL, created_at TEXT NOT NULL, design TEXT NOT NULL, assumptions TEXT NOT NULL, changes TEXT NOT NULL, analysis TEXT NOT NULL, geometry_hash TEXT NOT NULL)")
    db.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    db.commit()
    return db

def serialize(row, full=True):
    if row is None:
        return None
    data = dict(row)
    for field in ("design", "assumptions", "changes", "analysis"):
        data[field] = json.loads(data[field])
    return data

def get_version(id):
    with connect() as db:
        return serialize(db.execute("SELECT * FROM versions WHERE id=?", (id,)).fetchone())

def get_selected():
    with connect() as db:
        row = db.execute("SELECT value FROM settings WHERE key='selected'").fetchone()
        return get_version(row[0]) if row else None

def select_version(id):
    if not get_version(id):
        raise ValueError("Design version not found.")
    with connect() as db:
        db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('selected',?)", (id,))

def list_versions(project_id=None):
    with connect() as db:
        if project_id:
            rows = db.execute("SELECT * FROM versions WHERE project_id=? ORDER BY number DESC", (project_id,)).fetchall()
        else:
            rows = db.execute("SELECT * FROM versions ORDER BY created_at DESC").fetchall()
        return [serialize(row) for row in rows]

def save_version(design, analysis, geometry_hash, label, prompt, engine, assumptions, changes, parent=None):
    id = uuid.uuid4().hex
    project_id = parent["project_id"] if parent else uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        number = db.execute("SELECT COALESCE(MAX(number),0)+1 FROM versions WHERE project_id=?", (project_id,)).fetchone()[0]
        values = (id, project_id, parent["id"] if parent else None, number, label, prompt, engine, now,
                  json.dumps(design), json.dumps(assumptions), json.dumps(changes), json.dumps(analysis), geometry_hash)
        db.execute("INSERT INTO versions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", values)
        db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('selected',?)", (id,))
    return get_version(id)


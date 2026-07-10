import os
import sqlite3
from typing import Any

# Define database file path dynamically inside the backend folder
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "optima_agent.db")

def get_db_connection():
    """Establishes a connection to the SQLite database with dictionary-like row access."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn

def _column_exists(cursor: sqlite3.Cursor, table_name: str, column_name: str) -> bool:
    """Checks if a column exists before running a safe SQLite migration."""
    columns = cursor.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(col["name"] == column_name for col in columns)

def _add_column_if_missing(cursor: sqlite3.Cursor, table_name: str, column_name: str, definition: str):
    """Adds a column only when it is missing, preserving existing local data."""
    if not _column_exists(cursor, table_name, column_name):
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")

def init_db():
    """Creates the tables if they don't already exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Projects Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        csv_path TEXT NOT NULL,
        target_column TEXT NOT NULL,
        task_type TEXT NOT NULL CHECK(task_type IN ('classification', 'regression')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Agent Runs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS agent_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        run_number INTEGER NOT NULL,
        model_name TEXT,
        hyperparameters TEXT, -- Stored as a JSON string
        metric_name TEXT,     -- e.g. "accuracy" or "rmse"
        metric_value REAL,
        mlflow_run_id TEXT,
        code_path TEXT,       -- Path to the script the agent generated
        model_path TEXT,      -- Path to the trained .pkl file
        logs TEXT,            -- Console print logs of the run
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    # 3. Settings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)

    # 4. Agent Events Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS agent_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        run_id INTEGER,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        payload TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
    );
    """)

    # Non-breaking migrations for existing local databases.
    _add_column_if_missing(cursor, "projects", "row_count", "INTEGER")
    _add_column_if_missing(cursor, "projects", "column_count", "INTEGER")
    _add_column_if_missing(cursor, "projects", "metadata_json", "TEXT")
    _add_column_if_missing(cursor, "projects", "eda_summary", "TEXT")
    _add_column_if_missing(cursor, "projects", "current_status", "TEXT DEFAULT 'idle'")
    _add_column_if_missing(cursor, "projects", "last_error", "TEXT")
    _add_column_if_missing(cursor, "projects", "updated_at", "TIMESTAMP")

    _add_column_if_missing(cursor, "agent_runs", "status", "TEXT DEFAULT 'completed'")
    _add_column_if_missing(cursor, "agent_runs", "thought", "TEXT")
    _add_column_if_missing(cursor, "agent_runs", "action", "TEXT")
    _add_column_if_missing(cursor, "agent_runs", "error_message", "TEXT")
    _add_column_if_missing(cursor, "agent_runs", "started_at", "TIMESTAMP")
    _add_column_if_missing(cursor, "agent_runs", "completed_at", "TIMESTAMP")

    # 5. Users Log Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()

def update_project_status(project_id: int, status: str, error_message: str | None = None):
    """Updates the latest project lifecycle status shown by the frontend."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE projects
        SET current_status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (status, error_message, project_id)
    )
    conn.commit()
    conn.close()

def log_agent_event(
    project_id: int,
    event_type: str,
    message: str,
    run_id: int | None = None,
    payload: dict[str, Any] | None = None
):
    """Stores a timeline event for thought stream, status, and frontend polling."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO agent_events (project_id, run_id, event_type, message, payload)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            project_id,
            run_id,
            event_type,
            message,
            __import__("json").dumps(payload) if payload is not None else None
        )
    )
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)

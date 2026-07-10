import os
from dotenv import load_dotenv

# Load environment variables from .env file (located at the root)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
import json
import re
import shutil
import sqlite3
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database.connection import get_db_connection, init_db, update_project_status, log_agent_event
from agent.loop import run_agent_optimization_loop
from ml.automl import run_backend_automl
from ml.eda import analyze_csv_dataset
from ml.insights import build_project_insights

app = FastAPI(
    title="Optima ML Agent API",
    description="Autonomous ML Experiment Orchestration Engine",
    version="1.0.0"
)

# Enable CORS (allows our Next.js frontend to talk to our backend server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create an uploads folder to save dataset CSVs
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _safe_project_filename(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", name.strip().lower()).strip("_")
    slug = slug or "dataset"
    return f"{slug}_{uuid.uuid4().hex[:8]}.csv"

def _project_to_dict(row):
    project = dict(row)
    for key in ("metadata_json", "eda_summary"):
        if project.get(key):
            try:
                project[key] = json.loads(project[key])
            except json.JSONDecodeError:
                pass
    project["has_alarm"] = project.get("alarm_count", 0) > 0
    return project

def _run_to_dict(row):
    run = dict(row)
    if run.get("hyperparameters"):
        try:
            run["hyperparameters"] = json.loads(run["hyperparameters"])
        except json.JSONDecodeError:
            pass
    return run

def _event_to_dict(row):
    event = dict(row)
    if event.get("payload"):
        try:
            event["payload"] = json.loads(event["payload"])
        except json.JSONDecodeError:
            pass
    return event

def _is_better_metric(task_type: str, metric_name: str | None, candidate, current) -> bool:
    if candidate is None:
        return False
    if current is None:
        return True

    metric = (metric_name or "").lower()
    minimize_metrics = {"rmse", "mse", "mae", "loss", "log_loss"}
    maximize_metrics = {"accuracy", "f1", "f1_score", "precision", "recall", "r2", "r2_score"}

    if metric in minimize_metrics:
        return candidate < current
    if metric in maximize_metrics:
        return candidate > current
    if task_type == "regression":
        return candidate < current
    return candidate > current

# Initialize database tables automatically when the server starts
@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to the Optima ML Agent API Engine!",
        "version": "1.0.0"
    }

# ----------------- SETTINGS ENDPOINTS -----------------

from typing import List

class ApiKeysPayload(BaseModel):
    keys: List[str]

@app.post("/api/settings/keys")
def save_api_keys(payload: ApiKeysPayload):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Join list back to a comma-separated string for database storage
        joined_keys = ",".join(payload.keys)
        cursor.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('gemini_keys', ?)",
            (joined_keys,)
        )
        conn.commit()
        return {"status": "success", "message": "API keys saved successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/settings/keys")
def get_api_keys_status():
    # 1. Try reading from environment variable first
    env_keys = os.getenv("GEMINI_API_KEYS")
    if env_keys and env_keys.strip():
        parsed = [k.strip() for k in env_keys.split(",") if k.strip() and not k.strip().startswith("AIzaSyPlaceholder")]
        if parsed:
            return {"configured": True, "count": len(parsed), "source": "env"}

    # 2. Fallback to settings database table
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM settings WHERE key = 'gemini_keys'").fetchone()
    conn.close()
    
    if not row or not row["value"].strip():
        return {"configured": False, "count": 0, "source": "none"}
    
    keys = [k.strip() for k in row["value"].split(",") if k.strip()]
    return {"configured": len(keys) > 0, "count": len(keys), "source": "db"}

@app.post("/api/settings/keys/test")
def test_api_keys():
    from agent.rotation import ApiKeyRotator
    import google.generativeai as genai
    try:
        rotator = ApiKeyRotator()
        key = rotator.get_current_key()
        genai.configure(api_key=key)
        
        # Test call to flash model (using gemini-2.5-flash)
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content("Ping. Reply with exactly the word 'Pong'.")
        return {"status": "success", "response": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection test failed: {str(e)}")

# ----------------- PROJECT ENDPOINTS -----------------

@app.post("/api/projects/upload")
def upload_project(
    name: str = Form(...),
    target_column: str = Form(...),
    task_type: str = Form(...),
    file: UploadFile = File(...)
):
    # Validate Task Type
    if task_type not in ("classification", "regression"):
        raise HTTPException(status_code=400, detail="task_type must be either 'classification' or 'regression'.")

    if not name.strip():
        raise HTTPException(status_code=400, detail="Project name cannot be empty.")

    if not target_column.strip():
        raise HTTPException(status_code=400, detail="Target column cannot be empty.")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a valid .csv file.")

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Auto-resolve duplicate project names by appending an incremental suffix
    original_name = name
    counter = 1
    while True:
        duplicate = cursor.execute("SELECT id FROM projects WHERE name = ?", (name,)).fetchone()
        if not duplicate:
            break
        name = f"{original_name}_{counter}"
        counter += 1
        
    conn.close()

    # Save CSV File
    filename = _safe_project_filename(name)
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    try:
        analysis = analyze_csv_dataset(file_path, target_column, task_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    metadata = analysis["metadata"]
    eda_summary = analysis["eda_summary"]

    # Register in SQLite DB
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO projects (
                name, csv_path, target_column, task_type,
                row_count, column_count, metadata_json, eda_summary,
                current_status, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', CURRENT_TIMESTAMP)
            """,
            (
                name,
                file_path,
                target_column,
                task_type,
                metadata["row_count"],
                metadata["column_count"],
                json.dumps(metadata),
                json.dumps(eda_summary),
            )
        )
        conn.commit()
        project_id = cursor.lastrowid
        log_agent_event(
            project_id=project_id,
            event_type="project_uploaded",
            message=f"Project '{name}' uploaded and validated successfully.",
            payload={"metadata": metadata, "warnings": eda_summary.get("warnings", [])},
        )
        return {
            "status": "success",
            "project_id": project_id,
            "metadata": metadata,
            "eda_summary": eda_summary,
            "message": f"Project '{name}' created successfully!"
        }
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail=f"Project with name '{name}' already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/projects")
def list_projects():
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        """
        SELECT p.*,
               (SELECT COUNT(*) FROM agent_runs WHERE project_id = p.id AND logs LIKE '%validation_alarm%') as alarm_count
        FROM projects p
        ORDER BY p.created_at DESC
        """
    ).fetchall()
    conn.close()
    
    return [_project_to_dict(r) for r in rows]

@app.get("/api/projects/{project_id}")
def get_project(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        """
        SELECT p.*,
               (SELECT COUNT(*) FROM agent_runs WHERE project_id = p.id AND logs LIKE '%validation_alarm%') as alarm_count
        FROM projects p
        WHERE p.id = ?
        """,
        (project_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Project not found.")

    return _project_to_dict(row)

@app.get("/api/projects/{project_id}/status")
def get_project_status(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        """
        SELECT id, name, current_status, last_error, row_count, column_count, updated_at
        FROM projects
        WHERE id = ?
        """,
        (project_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Project not found.")

    return dict(row)

@app.get("/api/projects/{project_id}/runs")
def list_project_runs(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if project exists
    project = cursor.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found.")

    rows = cursor.execute(
        "SELECT * FROM agent_runs WHERE project_id = ? ORDER BY run_number DESC",
        (project_id,)
    )
    runs = [_run_to_dict(r) for r in rows]
        
    conn.close()
    return runs

@app.get("/api/projects/{project_id}/events")
def list_project_events(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    project = cursor.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found.")

    rows = cursor.execute(
        """
        SELECT * FROM agent_events
        WHERE project_id = ?
        ORDER BY created_at ASC, id ASC
        """,
        (project_id,)
    ).fetchall()
    conn.close()

    return [_event_to_dict(row) for row in rows]

@app.get("/api/projects/{project_id}/best-run")
def get_best_project_run(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    project = cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found.")

    rows = cursor.execute(
        """
        SELECT * FROM agent_runs
        WHERE project_id = ?
          AND metric_value IS NOT NULL
          AND status != 'failed'
        ORDER BY run_number DESC
        """,
        (project_id,)
    ).fetchall()
    conn.close()

    best_run = None
    best_value = None
    for row in rows:
        run = _run_to_dict(row)
        if _is_better_metric(project["task_type"], run.get("metric_name"), run.get("metric_value"), best_value):
            best_run = run
            best_value = run.get("metric_value")

    if not best_run:
        return {"project_id": project_id, "best_run": None}

    return {"project_id": project_id, "best_run": best_run}

def _load_project_dashboard_data(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    project_row = cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found.")

    run_rows = cursor.execute(
        "SELECT * FROM agent_runs WHERE project_id = ? ORDER BY run_number DESC",
        (project_id,)
    ).fetchall()
    event_rows = cursor.execute(
        """
        SELECT * FROM agent_events
        WHERE project_id = ?
        ORDER BY created_at ASC, id ASC
        """,
        (project_id,)
    ).fetchall()
    conn.close()

    project = _project_to_dict(project_row)
    runs = [_run_to_dict(row) for row in run_rows]
    events = [_event_to_dict(row) for row in event_rows]

    best_run = None
    best_value = None
    for run in runs:
        if run.get("metric_value") is None or run.get("status") == "failed":
            continue
        if _is_better_metric(project["task_type"], run.get("metric_name"), run.get("metric_value"), best_value):
            best_run = run
            best_value = run.get("metric_value")

    insights = build_project_insights(
        project=project,
        eda_summary=project.get("eda_summary"),
        runs=runs,
        best_run=best_run,
    )

    return {
        "project": project,
        "runs": runs,
        "events": events,
        "best_run": best_run,
        "insights": insights,
    }

@app.get("/api/projects/{project_id}/insights")
def get_project_insights(project_id: int):
    dashboard = _load_project_dashboard_data(project_id)
    
    # Generate dynamic Gemini AI insights
    from ml.insights import generate_gemini_insights
    try:
        ai_insights = generate_gemini_insights(
            project=dashboard["project"],
            eda_summary=dashboard["project"].get("eda_summary"),
            runs=dashboard["runs"]
        )
    except Exception as e:
        ai_insights = f"⚠️ *Failed to generate AI insights: {str(e)}*"

    return {
        "project_id": project_id,
        "insights": dashboard["insights"],
        "ai_insights": ai_insights
    }

@app.get("/api/projects/{project_id}/dashboard")
def get_project_dashboard(project_id: int):
    return _load_project_dashboard_data(project_id)

# ----------------- AGENT OPTIMIZATION ROUTE -----------------

@app.post("/api/projects/{project_id}/automl")
def start_backend_automl(
    project_id: int,
    background_tasks: BackgroundTasks,
    selected_models: str = Query(None)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    project = cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    update_project_status(project_id, "automl_queued")
    log_agent_event(
        project_id=project_id,
        event_type="automl_queued",
        message=f"Backend AutoML queued for project '{project['name']}'."
    )

    background_tasks.add_task(run_backend_automl, project_id, selected_models)

    return {
        "status": "triggered",
        "message": f"Backend AutoML triggered for project '{project['name']}'!",
        "project": _project_to_dict(project)
    }

@app.post("/api/projects/{project_id}/optimize")
def start_optimization(project_id: int, background_tasks: BackgroundTasks):
    conn = get_db_connection()
    cursor = conn.cursor()
    project = cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    update_project_status(project_id, "queued")
    log_agent_event(
        project_id=project_id,
        event_type="optimization_queued",
        message=f"Optimization queued for project '{project['name']}'."
    )
        
    # Schedule the real autonomous AI optimization loop in the background
    background_tasks.add_task(run_agent_optimization_loop, project_id)
        
    return {
        "status": "triggered",
        "message": f"AutoML Agent optimization session triggered for project '{project['name']}'!",
        "project": _project_to_dict(project)
    }

# ----------------- MODEL DOWNLOAD & PREDICTION ENDPOINTS -----------------

class PredictionPayload(BaseModel):
    inputs: dict

@app.get("/api/models/download/{run_id}")
def download_model(run_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    run = cursor.execute("SELECT model_path, model_name FROM agent_runs WHERE id = ?", (run_id,)).fetchone()
    conn.close()

    if not run or not run["model_path"]:
        raise HTTPException(status_code=404, detail="Model file not found.")

    model_path = run["model_path"]
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file does not exist on disk.")

    from fastapi.responses import FileResponse
    # Return as attachment so browser triggers download save dialog
    return FileResponse(
        path=model_path,
        filename=os.path.basename(model_path),
        media_type="application/octet-stream"
    )

@app.post("/api/models/{run_id}/predict")
def predict_model(run_id: int, payload: PredictionPayload):
    import joblib
    import pandas as pd
    import numpy as np

    conn = get_db_connection()
    cursor = conn.cursor()
    run = cursor.execute("SELECT * FROM agent_runs WHERE id = ?", (run_id,)).fetchone()
    if not run:
        conn.close()
        raise HTTPException(status_code=404, detail="Model run not found.")
        
    project = cursor.execute("SELECT * FROM projects WHERE id = ?", (run["project_id"],)).fetchone()
    conn.close()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    model_path = run["model_path"]
    if not model_path or not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file does not exist on disk.")

    # Load project features list from eda_summary
    try:
        eda_summary = json.loads(project["eda_summary"])
        columns_meta = eda_summary.get("columns", [])
    except Exception:
        columns_meta = []

    # Identify all feature columns (excluding target)
    feature_cols = [c["name"] for c in columns_meta if not c.get("is_target")]
    if not feature_cols:
        raise HTTPException(status_code=400, detail="No feature schema found for this project.")

    # Map column types for proper conversion
    col_roles = {c["name"]: c.get("role", "numeric") for c in columns_meta}

    # Construct the input row with proper typing
    row_data = {}
    for col in feature_cols:
        val = payload.inputs.get(col)
        role = col_roles.get(col, "numeric")

        if val is None or str(val).strip() == "":
            row_data[col] = np.nan
        else:
            try:
                if role == "numeric":
                    row_data[col] = float(val)
                elif role == "boolean":
                    row_data[col] = bool(val)
                else:
                    row_data[col] = str(val)
            except Exception:
                row_data[col] = val  # fallback

    try:
        # Load scikit-learn pipeline
        pipeline = joblib.load(model_path)
        
        # Create DataFrame with exact column list
        df = pd.DataFrame([row_data], columns=feature_cols)
        
        # Run prediction
        prediction = pipeline.predict(df)
        pred_val = prediction[0]

        # Convert numpy types to JSON-safe python types
        if hasattr(pred_val, "item"):
            pred_val = pred_val.item()
        elif isinstance(pred_val, np.ndarray):
            pred_val = pred_val.tolist()

        # Handle target classes mapping
        prediction_label = None
        try:
            raw_hp = run["hyperparameters"]
            hp_dict = json.loads(raw_hp) if isinstance(raw_hp, str) else raw_hp
            if hp_dict and "target_classes" in hp_dict:
                target_classes = hp_dict["target_classes"]
                if target_classes and isinstance(target_classes, list):
                    idx = int(pred_val)
                    if 0 <= idx < len(target_classes):
                        prediction_label = str(target_classes[idx])
        except Exception:
            pass

        # Handle classification probabilities if supported
        prob_data = None
        if hasattr(pipeline, "predict_proba"):
            try:
                probs = pipeline.predict_proba(df)[0]
                classes = pipeline.classes_
                prob_data = {str(c): float(p) for c, p in zip(classes, probs)}
            except Exception:
                pass

        return {
            "status": "success",
            "prediction": pred_val,
            "prediction_label": prediction_label,
            "probabilities": prob_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/api/runs/{run_id}/details")
def get_run_details(run_id: int):
    import joblib
    import numpy as np

    conn = get_db_connection()
    cursor = conn.cursor()
    run = cursor.execute("SELECT * FROM agent_runs WHERE id = ?", (run_id,)).fetchone()
    if not run:
        conn.close()
        raise HTTPException(status_code=404, detail="Run not found.")
        
    project = cursor.execute("SELECT * FROM projects WHERE id = ?", (run["project_id"],)).fetchone()
    conn.close()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    model_path = run["model_path"]
    feature_importances = {}

    if model_path and os.path.exists(model_path):
        try:
            # Parse project columns schema from eda_summary
            eda_summary = json.loads(project["eda_summary"])
            columns_meta = eda_summary.get("columns", [])
            feature_cols = [c["name"] for c in columns_meta if not c.get("is_target")]

            pipeline = joblib.load(model_path)
            preprocessor = pipeline.named_steps["preprocessor"]
            feature_names = preprocessor.get_feature_names_out()
            model = pipeline.named_steps["model"]

            weights = None
            if hasattr(model, "feature_importances_"):
                weights = model.feature_importances_
            elif hasattr(model, "coef_"):
                if len(model.coef_.shape) > 1:
                    weights = np.mean(np.abs(model.coef_), axis=0)
                else:
                    weights = np.abs(model.coef_)

            if weights is not None and len(weights) == len(feature_names):
                importance_map = {}
                for name, w in zip(feature_names, weights):
                    # split out original column name from standard "transformer__colname_category"
                    parts = name.split("__")
                    original_col = parts[1] if len(parts) > 1 else parts[0]
                    
                    matched = False
                    for original in feature_cols:
                        if original_col.startswith(original) or original in original_col:
                            importance_map[original] = importance_map.get(original, 0.0) + float(w)
                            matched = True
                            break
                    if not matched:
                        importance_map[original_col] = importance_map.get(original_col, 0.0) + float(w)
                
                total_w = sum(importance_map.values())
                if total_w > 0:
                    feature_importances = {k: round(v / total_w, 4) for k, v in importance_map.items()}
        except Exception:
            pass  # skip if model cannot extract importances

    # Prepare response
    try:
        hyperparameters = json.loads(run["hyperparameters"]) if run["hyperparameters"] else {}
    except Exception:
        hyperparameters = {}

    try:
        metrics = json.loads(run["logs"]) if run["logs"] else {}
        if isinstance(metrics, dict) and "metrics" in metrics:
            metrics = metrics["metrics"]
    except Exception:
        metrics = {}

    return {
        "id": run["id"],
        "project_id": run["project_id"],
        "run_number": run["run_number"],
        "model_name": run["model_name"],
        "metric_name": run["metric_name"],
        "metric_value": run["metric_value"],
        "status": run["status"],
        "thought": run["thought"],
        "logs": run["logs"],
        "hyperparameters": hyperparameters,
        "metrics": metrics,
        "feature_importances": feature_importances,
        "mlflow_run_id": run["mlflow_run_id"],
        "started_at": run["started_at"],
        "completed_at": run["completed_at"],
    }

@app.get("/api/models/export/{run_id}")
def export_model_bundle(run_id: int, background_tasks: BackgroundTasks):
    import joblib
    import shutil
    import tempfile

    conn = get_db_connection()
    cursor = conn.cursor()
    run = cursor.execute("SELECT * FROM agent_runs WHERE id = ?", (run_id,)).fetchone()
    if not run:
        conn.close()
        raise HTTPException(status_code=404, detail="Model run not found.")
        
    project = cursor.execute("SELECT * FROM projects WHERE id = ?", (run["project_id"],)).fetchone()
    conn.close()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    model_path = run["model_path"]
    if not model_path or not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file does not exist on disk.")

    # Get features list
    try:
        eda_summary = json.loads(project["eda_summary"])
        columns_meta = eda_summary.get("columns", [])
        feature_cols = [c["name"] for c in columns_meta if not c.get("is_target")]
        target_col = project["target_column"]
    except Exception:
        feature_cols = []
        target_col = "target"

    # Create temporary packaging dir
    export_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "exports")
    os.makedirs(export_dir, exist_ok=True)
    temp_dir = tempfile.mkdtemp(dir=export_dir)

    try:
        # 1. Copy model pkl file
        dest_model_path = os.path.join(temp_dir, "model.pkl")
        shutil.copy2(model_path, dest_model_path)

        # 2. Build sample JSON payload
        sample_payload = {col: 1.0 if "num" in col else "value" for col in feature_cols}
        sample_json_str = json.dumps(sample_payload)

        # 3. Create predict.py
        predict_script = f"""# predict.py - Auto-generated by OptiAgentML
import sys
import json
import joblib
import pandas as pd

print("⏳ Loading model.pkl pipeline...")
try:
    pipeline = joblib.load("model.pkl")
except Exception as e:
    print(f"❌ Error loading model: {{e}}")
    sys.exit(1)

# Check CLI args
if len(sys.argv) < 2:
    print("\\n❌ Usage: python predict.py '<json_input>'")
    print("Example:")
    print(f"python predict.py '{{sample_json_str}}'")
    sys.exit(1)

try:
    inputs = json.loads(sys.argv[1])
except Exception as e:
    print(f"❌ Error parsing JSON input: {{e}}")
    sys.exit(1)

# Convert to DataFrame
df = pd.DataFrame([inputs])

# Predict
try:
    prediction = pipeline.predict(df)[0]
    print(f"\\n🎯 Prediction: {{prediction}}")
    
    if hasattr(pipeline, "predict_proba"):
        probs = pipeline.predict_proba(df)[0]
        classes = pipeline.classes_
        print("\\n📊 Class Probabilities:")
        for c, p in zip(classes, probs):
            print(f"  {{c}}: {{p*100:.1f}}%")
except Exception as e:
    print(f"❌ Prediction error: {{e}}")
"""
        with open(os.path.join(temp_dir, "predict.py"), "w") as f:
            f.write(predict_script)

        # 4. Create README.md
        features_markdown = "\\n".join([f"* `{col}`" for col in feature_cols])
        readme_content = f"""# OptiAgentML — Model Export Package

This package contains your trained machine learning pipeline and a helper script to run local predictions.

## Files Included:
* `model.pkl`: The serialized scikit-learn pipeline (preprocessing + model).
* `predict.py`: Command Line Interface (CLI) prediction runner.
* `README.md`: Instruction manual.

## Installation
Install required dependencies:
```bash
pip install pandas scikit-learn joblib
```

## Running Predictions
Pass the input features as a JSON string to `predict.py`:
```bash
python predict.py '{sample_json_str}'
```

### Required Features:
{features_markdown}

---
Generated by OptiAgentML.
"""
        with open(os.path.join(temp_dir, "README.md"), "w") as f:
            f.write(readme_content)

        # Zip directory
        zip_base_name = os.path.join(export_dir, f"model_bundle_run_{run_id}")
        zip_archive_path = shutil.make_archive(zip_base_name, "zip", temp_dir)

        # Clean up temp folder immediately, serve the zip in background
        shutil.rmtree(temp_dir)
        
        # Schedule zip deletion after response is sent
        background_tasks.add_task(os.remove, zip_archive_path)

        from fastapi.responses import FileResponse
        return FileResponse(
            path=zip_archive_path,
            filename=os.path.basename(zip_archive_path),
            media_type="application/zip"
        )
    except Exception as e:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        raise HTTPException(status_code=500, detail=f"Export bundling failed: {str(e)}")

@app.delete("/api/models/{run_id}")
def delete_model(run_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    run = cursor.execute("SELECT model_path FROM agent_runs WHERE id = ?", (run_id,)).fetchone()
    
    if not run:
        conn.close()
        raise HTTPException(status_code=404, detail="Model run not found.")

    # Remove file from disk
    model_path = run["model_path"]
    if model_path and os.path.exists(model_path):
        try:
            os.remove(model_path)
        except Exception:
            pass # continue deleting DB record even if file deletion fails

    # Delete database record
    try:
        cursor.execute("DELETE FROM agent_runs WHERE id = ?", (run_id,))
        conn.commit()
        return {"status": "success", "message": "Model deleted successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()


class UserLoginPayload(BaseModel):
    email: str

@app.post("/api/users/login")
def log_user_login(payload: UserLoginPayload):
    # 1. Log to SQLite database for frontend UI stats
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users_log (email) VALUES (?)", (payload.email,))
        conn.commit()
    except Exception as e:
        print("SQLite user log error:", e)
    finally:
        conn.close()

    # 2. Log to a CSV file for Excel / Sheets access
    try:
        import csv
        from datetime import datetime
        csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users_log.csv")
        file_exists = os.path.exists(csv_path)
        with open(csv_path, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["Email", "Logged At"])
            writer.writerow([payload.email, datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    except Exception as csv_err:
        print("CSV user log error:", csv_err)

    return {"status": "success", "message": "Login recorded."}

@app.get("/api/users/stats")
def get_user_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        def mask_email(email: str) -> str:
            try:
                parts = email.split("@")
                if len(parts) != 2:
                    return email
                name, domain = parts[0], parts[1]
                if len(name) <= 2:
                    masked_name = name[0] + "*" * (len(name) - 1)
                else:
                    masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
                return f"{masked_name}@{domain}"
            except Exception:
                return email

        unique_users_rows = cursor.execute("SELECT DISTINCT email FROM users_log").fetchall()
        unique_users = [mask_email(row["email"]) for row in unique_users_rows]
        
        logins_rows = cursor.execute("SELECT email, logged_at FROM users_log ORDER BY id DESC LIMIT 50").fetchall()
        logins = [{"email": mask_email(row["email"]), "logged_at": row["logged_at"]} for row in logins_rows]
        
        counts_rows = cursor.execute("SELECT email, COUNT(*) as count, MAX(logged_at) as last_active FROM users_log GROUP BY email ORDER BY count DESC").fetchall()
        user_counts = [{"email": mask_email(row["email"]), "count": row["count"], "last_active": row["last_active"]} for row in counts_rows]
        
        return {
            "total_unique_users": len(unique_users),
            "unique_users": unique_users,
            "logins": logins,
            "user_counts": user_counts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()




import os
import sys
import json
import sqlite3
import pandas as pd
import numpy as np

# Adjust Python search path to find backend modules
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from database.connection import get_db_connection
from ml.automl import run_backend_automl

def main():
    print("⏳ Day 25: Initializing validation alarm tests...")
    
    # 1. Create a noisy dataset
    csv_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "uploads")
    os.makedirs(csv_dir, exist_ok=True)
    csv_path = os.path.join(csv_dir, "noisy_alarm_test.csv")
    
    # Generate random features with random labels (no pattern)
    np.random.seed(42)
    rows = 100
    df = pd.DataFrame({
        "feature_1": np.random.randn(rows),
        "feature_2": np.random.randn(rows),
        "feature_3": np.random.randn(rows),
        "label": np.random.choice([0, 1], size=rows)
    })
    df.to_csv(csv_path, index=False)
    print("✓ Noisy classification dataset generated.")
    
    # 2. Register project in SQLite
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Delete old test project if exists
    cursor.execute("DELETE FROM projects WHERE name = 'Noisy Alarm Test'")
    conn.commit()
    
    # Add dummy eda summary columns list
    eda_summary = {
        "metadata": {"row_count": rows, "column_count": 4},
        "columns": [
            {"name": "feature_1", "role": "numeric", "is_target": False},
            {"name": "feature_2", "role": "numeric", "is_target": False},
            {"name": "feature_3", "role": "numeric", "is_target": False},
            {"name": "label", "role": "numeric", "is_target": True}
        ],
        "missing_total": 0,
        "duplicate_rows": 0,
        "warnings": []
    }
    
    cursor.execute(
        """
        INSERT INTO projects (
            name, csv_path, target_column, task_type,
            row_count, column_count, metadata_json, eda_summary,
            current_status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', CURRENT_TIMESTAMP)
        """,
        (
            "Noisy Alarm Test",
            csv_path,
            "label",
            "classification",
            rows,
            4,
            json.dumps(eda_summary["metadata"]),
            json.dumps(eda_summary)
        )
    )
    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    print(f"✓ Registered 'Noisy Alarm Test' project (ID: {project_id}).")
    
    # 3. Trigger backend AutoML runner synchronously
    print("⏳ Training models (AutoML is running)...")
    try:
        run_backend_automl(project_id)
        print("✓ AutoML runs completed successfully.")
    except Exception as e:
        print(f"❌ AutoML training crashed: {e}")
        sys.exit(1)
        
    # 4. Verify SQLite database alerts
    conn = get_db_connection()
    cursor = conn.cursor()
    
    runs = cursor.execute("SELECT * FROM agent_runs WHERE project_id = ?", (project_id,)).fetchall()
    events = cursor.execute("SELECT * FROM agent_events WHERE project_id = ? AND event_type = 'validation_alarm'", (project_id,)).fetchall()
    
    print("\n" + "="*50)
    print("DIAGNOSTIC TEST REPORT")
    print("="*50)
    print(f"Total runs trained: {len(runs)}")
    print(f"Total validation alarms in agent_events: {len(events)}")
    
    success = True
    
    # Audit each run
    for r in runs:
        logs = json.loads(r["logs"]) if r["logs"] else {}
        alarm = logs.get("validation_alarm")
        metric_val = r["metric_value"]
        
        print(f"\n- Run #{r['run_number']} ({r['model_name']}):")
        print(f"  Score (Accuracy): {metric_val:.4f}")
        if alarm:
            print(f"  🚨 Validation Alarm: {alarm}")
        else:
            print("  ✅ Passed (No Alarm)")
            
    # Check assertions
    if len(events) == 0:
        print("\n❌ FAILED: No validation warnings logged in agent_events.")
        success = False
    else:
        print("\n✓ SUCCESS: Warning events successfully recorded in SQLite.")
        
    conn.close()
    
    if success:
        print("\n🎉 Day 25 Test Passed: Validation Alarms working perfectly! 🎉")
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()

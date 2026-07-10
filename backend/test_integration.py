# backend/test_integration.py

import os
import sys
import json

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.connection import get_db_connection, init_db
from agent.loop import run_agent_optimization_loop

def run_integration_test():
    print("🚀 STARTING WEEK 2 INTEGRATION GRADUATION TEST 🚀")
    
    # 1. Initialize DB tables
    init_db()
    
    # 2. Register/Fetch a project
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row if 'sqlite3' in sys.modules else conn.row_factory
    cursor = conn.cursor()
    
    # Check if a project already exists
    project = cursor.execute("SELECT * FROM projects LIMIT 1").fetchone()
    
    if not project:
        # Create a new project for Spam Classification
        csv_path = "/Users/rajkumarsharma/Desktop/ Ml_Experiment_Orchestrator /spam_dataset.csv"
        # Verify file exists
        if not os.path.exists(csv_path):
            # Fallback to local search if desktop path doesn't align
            csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "spam_dataset.csv")
            
        print(f"📝 No projects found. Registering a new project pointing to: {csv_path}")
        
        try:
            cursor.execute(
                """
                INSERT INTO projects (name, csv_path, target_column, task_type)
                VALUES (?, ?, ?, ?)
                """,
                ("SMS Spam Classifier Test", csv_path, "label", "classification")
            )
            conn.commit()
            project = cursor.execute("SELECT * FROM projects LIMIT 1").fetchone()
            print(f"✅ Registered test project: {dict(project)}")
        except Exception as e:
            print(f"❌ Failed to register test project: {str(e)}")
            conn.close()
            return
            
    else:
        print(f"✅ Found existing project: {dict(project)}")
        
    project_id = project["id"]
    conn.close()

    # 3. Trigger the real Agent ReAct Optimization Loop (3 iterations limit)
    try:
        print(f"\n🧠 Triggering agent optimization loop for project ID: {project_id}...")
        run_agent_optimization_loop(project_id=project_id, max_iterations=3)
        print("\n🎉 Optimization loop execution finished successfully!")
    except Exception as e:
        print(f"\n❌ Optimization loop crashed: {str(e)}")
        return

    # 4. Query and print the logged runs from SQLite
    print("\n📊 VERIFYING DATABASE RECORDINGS:")
    conn = get_db_connection()
    cursor = conn.cursor()
    runs = cursor.execute("SELECT * FROM agent_runs WHERE project_id = ? ORDER BY run_number ASC", (project_id,)).fetchall()
    conn.close()
    
    print(f"Total runs logged in DB: {len(runs)}")
    for r in runs:
        print(f"\n--- Run #{r['run_number']} ---")
        print(f"  Model Name: {r['model_name']}")
        print(f"  Hyperparameters: {r['hyperparameters']}")
        print(f"  Metric: {r['metric_name']} = {r['metric_value']}")
        print(f"  MLflow Run ID: {r['mlflow_run_id']}")
        print(f"  Model Saved Path: {r['model_path']}")
        print(f"  Code Executed Path: {r['code_path']}")

if __name__ == "__main__":
    # Make sure sqlite3 is imported for row factory fallback
    import sqlite3
    run_integration_test()

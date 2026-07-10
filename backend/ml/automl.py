import json
import os
import traceback

import joblib

from database.connection import get_db_connection, log_agent_event, update_project_status
from ml.metrics import is_better
from ml.trainer import train_candidate_models
def run_backend_automl(project_id: int, selected_models: str = None) -> dict:
    """
    Runs deterministic backend-owned AutoML without calling Gemini.
    Trains multiple sklearn pipelines, records each model trial, and saves artifacts.
    """
    update_project_status(project_id, "automl_running")
    log_agent_event(project_id, "automl_started", "Backend AutoML run started.")

    conn = get_db_connection()
    cursor = conn.cursor()
    project = cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        conn.close()
        raise ValueError(f"Project with ID {project_id} does not exist.")

    last_run = cursor.execute(
        "SELECT MAX(run_number) as max_rn FROM agent_runs WHERE project_id = ?",
        (project_id,)
    ).fetchone()
    next_run_number = (last_run["max_rn"] or 0) + 1
    conn.close()

    try:
        results = train_candidate_models(
            csv_path=project["csv_path"],
            target_column=project["target_column"],
            task_type=project["task_type"],
            selected_models=selected_models
        )

        model_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "models")
        os.makedirs(model_dir, exist_ok=True)

        best_result = None
        best_model_path = None
        recorded_runs = []

        import mlflow
        try:
            mlflow.set_tracking_uri("http://127.0.0.1:5000")
            mlflow.set_experiment(project["name"])
        except Exception as e:
            print(f"⚠️ Failed to connect to MLflow server: {e}")

        # Pre-load dataset and split for plot generation
        import pandas as pd
        from ml.trainer import _split_data
        from ml.metrics import generate_confusion_matrix_plot, generate_residuals_plot
        from sklearn.preprocessing import LabelEncoder

        try:
            df_plot = pd.read_csv(project["csv_path"])
            df_plot = df_plot.dropna(subset=[project["target_column"]]).copy()
            X_plot = df_plot.drop(columns=[project["target_column"]])
            y_plot = df_plot[project["target_column"]]
            
            le_plot = None
            if project["task_type"] == "classification":
                le_plot = LabelEncoder()
                y_plot = le_plot.fit_transform(y_plot.astype(str))
                
            _, X_test_plot, _, y_test_plot = _split_data(X_plot, y_plot, project["task_type"])
        except Exception as e:
            X_test_plot, y_test_plot, le_plot = None, None, None
            print(f"⚠️ Failed to prepare test split for plot generation: {e}")

        for result in results:
            model_filename = f"model_proj_{project_id}_automl_run_{next_run_number}.pkl"
            model_path = os.path.join(model_dir, model_filename)
            joblib.dump(result.pipeline, model_path)

            # Log to MLflow (Skip entirely on Render to prevent network connection timeouts and speed up execution)
            mlflow_run_id = None
            if os.environ.get("RENDER") != "true":
                try:
                    run_name = f"{result.model_name}_Run_{next_run_number}"
                    with mlflow.start_run(run_name=run_name) as active_run:
                        mlflow_run_id = active_run.info.run_id
                        
                        # Log parameters
                        params = {
                            "model_type": result.model_name,
                            "task_type": project["task_type"],
                            "target_column": project["target_column"],
                        }
                        if isinstance(result.hyperparameters, dict):
                            for k, v in result.hyperparameters.items():
                                if k not in ("metrics", "feature_roles"):
                                    params[k] = str(v)
                        mlflow.log_params(params)
                        
                        # Log metrics
                        if isinstance(result.metrics, dict):
                            for k, v in result.metrics.items():
                                try:
                                    mlflow.log_metric(k, float(v))
                                except Exception:
                                    pass
                        
                        # Generate and log evaluation plot
                        if X_test_plot is not None and y_test_plot is not None:
                            y_pred_plot = result.pipeline.predict(X_test_plot)
                            plot_path = None
                            if project["task_type"] == "classification":
                                labels = list(le_plot.classes_) if le_plot else None
                                plot_path = generate_confusion_matrix_plot(y_test_plot, y_pred_plot, labels=labels)
                            else:
                                plot_path = generate_residuals_plot(y_test_plot, y_pred_plot)
                                
                            if plot_path and os.path.exists(plot_path):
                                mlflow.log_artifact(plot_path)
                                try:
                                    os.remove(plot_path)
                                except Exception:
                                    pass
                except Exception as e:
                    print(f"⚠️ Failed to log run to MLflow: {e}")

            # Run quality validation thresholds check
            validation_alarm = None
            try:
                if isinstance(result.metrics, dict):
                    acc = result.metrics.get("accuracy")
                    f1 = result.metrics.get("f1_score")
                    r2 = result.metrics.get("r2_score")
                    
                    if project["task_type"] == "classification":
                        if acc is not None and acc < 0.65:
                            validation_alarm = f"Validation Accuracy ({acc*100:.1f}%) fell below 65.0% quality baseline."
                        elif f1 is not None and f1 < 0.65:
                            validation_alarm = f"Validation F1-Score ({f1*100:.1f}%) fell below 65.0% quality baseline."
                    elif project["task_type"] == "regression":
                        if r2 is not None and r2 < 0.10:
                            validation_alarm = f"Validation R2 Score ({r2*100:.1f}%) fell below 10.0% quality baseline."
            except Exception as e:
                print(f"⚠️ Warning threshold check failed: {e}")

            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO agent_runs (
                    project_id, run_number, model_name, hyperparameters,
                    metric_name, metric_value, mlflow_run_id,
                    code_path, model_path, logs, status, thought, action,
                    error_message, started_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    project_id,
                    next_run_number,
                    result.model_name,
                    json.dumps(result.hyperparameters),
                    result.metric_name,
                    float(result.metric_value),
                    mlflow_run_id,
                    None,
                    model_path,
                    json.dumps({"metrics": result.metrics, "validation_alarm": validation_alarm}),
                    "completed",
                    f"Backend AutoML trained {result.model_name}.",
                    "backend_automl",
                    None,
                )
            )
            run_id = cursor.lastrowid
            conn.commit()
            conn.close()

            if validation_alarm:
                try:
                    log_agent_event(
                        project_id,
                        "validation_alarm",
                        f"⚠️ QUALITY WARNING for run #{next_run_number} ({result.model_name}): {validation_alarm}",
                        run_id=run_id,
                        payload={"validation_alarm": validation_alarm, "metrics": result.metrics}
                    )
                except Exception as e:
                    print(f"⚠️ Failed to log validation event: {e}")

            recorded_runs.append(
                {
                    "run_id": run_id,
                    "run_number": next_run_number,
                    "model_name": result.model_name,
                    "metric_name": result.metric_name,
                    "metric_value": result.metric_value,
                    "model_path": model_path,
                    "metrics": result.metrics,
                    "mlflow_run_id": mlflow_run_id,
                }
            )

            log_agent_event(
                project_id,
                "automl_model_trained",
                f"{result.model_name} trained with {result.metric_name}={result.metric_value:.4f}.",
                run_id=run_id,
                payload={"metrics": result.metrics, "model_path": model_path},
            )

            if best_result is None or is_better(project["task_type"], result.metric_value, best_result.metric_value):
                best_result = result
                best_model_path = model_path

            next_run_number += 1

        update_project_status(project_id, "completed")
        log_agent_event(
            project_id,
            "automl_completed",
            f"Backend AutoML completed. Best model: {best_result.model_name}.",
            payload={
                "best_model": best_result.model_name,
                "metric_name": best_result.metric_name,
                "metric_value": best_result.metric_value,
                "model_path": best_model_path,
            },
        )

        return {
            "status": "completed",
            "project_id": project_id,
            "runs": recorded_runs,
            "best_model": {
                "model_name": best_result.model_name,
                "metric_name": best_result.metric_name,
                "metric_value": best_result.metric_value,
                "model_path": best_model_path,
                "metrics": best_result.metrics,
            },
        }
    except Exception as exc:
        error_message = str(exc)
        update_project_status(project_id, "failed", error_message)
        log_agent_event(
            project_id,
            "automl_failed",
            error_message,
            payload={"traceback": traceback.format_exc()},
        )
        raise

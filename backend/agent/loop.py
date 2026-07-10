# backend/agent/loop.py

import os
import sys
import json
import shutil
import sqlite3
import google.generativeai as genai
from google.generativeai.types import GenerationConfig

# Ensure backend directory is in the path for proper module resolution
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import get_db_connection, update_project_status, log_agent_event
from sandbox.executor import execute_code_in_sandbox
from agent.prompt_templates import get_system_prompt
from agent.parser import clean_and_parse_json, format_error_feedback
from agent.rotation import ApiKeyRotator

def run_agent_optimization_loop(project_id: int, max_iterations: int = 3):
    """
    Main ReAct loop that manages autonomous code generation, sandbox execution,
    MLflow tracking, and self-debugging database updates.
    """
    terminal_status = "running"
    try:
        update_project_status(project_id, "running")
        log_agent_event(project_id, "optimization_started", "Optimization loop started.")

        # 1. Fetch project info from SQLite database
        conn = get_db_connection()
        cursor = conn.cursor()
        project = cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        
        if not project:
            conn.close()
            raise ValueError(f"Project with ID {project_id} does not exist.")
            
        # Get the next run number for this project
        last_run = cursor.execute(
            "SELECT MAX(run_number) as max_rn FROM agent_runs WHERE project_id = ?",
            (project_id,)
        ).fetchone()
        next_run_number = (last_run["max_rn"] or 0) + 1
        conn.close()

        data_path = project["csv_path"]
        target_column = project["target_column"]
        task_type = project["task_type"]

        # 2. Get API Key Rotator and configure Gemini model
        rotator = ApiKeyRotator()
        # Configure the SDK with the initial key
        genai.configure(api_key=rotator.get_current_key())
        
        system_prompt = get_system_prompt(data_path, target_column, task_type)
        
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system_prompt,
            generation_config=GenerationConfig(
                response_mime_type="application/json"
            )
        )

        # 3. Start Chat Session for ReAct history tracking
        chat = model.start_chat()
        
        current_iteration = 0
        prompt = "Let's begin. Write the first machine learning training code attempt."
        
        print(f"🤖 OptiAgentML: Starting optimization loop for project '{project['name']}' (ID: {project_id})")
        
        while current_iteration < max_iterations:
            current_iteration += 1
            print(f"\n--- Iteration {current_iteration}/{max_iterations} ---")
            log_agent_event(
                project_id,
                "iteration_started",
                f"Iteration {current_iteration}/{max_iterations} started.",
                payload={"iteration": current_iteration, "max_iterations": max_iterations}
            )
            
            try:
                # Send message to Gemini chat session using our API Key Rotator pool
                response = rotator.execute_with_rotation(chat.send_message, prompt)
                response_text = response.text
            except Exception as e:
                terminal_status = "failed"
                error_message = f"Gemini API call failed after rotation retries: {str(e)}"
                print(f"❌ {error_message}")
                update_project_status(project_id, "failed", error_message)
                log_agent_event(project_id, "optimization_failed", error_message)
                break

            # Parse agent response using robust parser
            try:
                agent_response = clean_and_parse_json(response_text)
            except ValueError as pe:
                prompt = f"Error: {str(pe)}"
                print(f"⚠️ Parsing error feedback sent to Gemini: {str(pe)}")
                log_agent_event(project_id, "parse_error", str(pe))
                continue

            thought = agent_response.get("thought", "")
            action = agent_response.get("action", "")
            code = agent_response.get("code", "")
            
            print(f"💭 Agent Thought: {thought}")
            print(f"🎬 Action Selected: {action}")
            log_agent_event(
                project_id,
                "agent_thought",
                thought or f"Agent selected action: {action}",
                payload={"iteration": current_iteration, "action": action}
            )

            # Check terminal condition
            if action == "finish":
                terminal_status = "completed"
                print("🎉 Agent has completed optimization and finalized the model.")
                log_agent_event(project_id, "optimization_completed", "Agent completed optimization.")
                update_project_status(project_id, "completed")
                break

            if action == "run_code":
                if not code.strip():
                    prompt = "Error: 'code' field is empty but action was 'run_code'. Please write the complete Python script to execute."
                    log_agent_event(project_id, "agent_error", "Agent returned run_code with an empty code field.")
                    continue
                    
                print("💾 Executing script in isolation sandbox...")
                log_agent_event(project_id, "sandbox_started", f"Executing run #{next_run_number} in sandbox.")
                exec_result = execute_code_in_sandbox(code)
                
                stdout = exec_result["stdout"]
                stderr = exec_result["stderr"]
                success = exec_result["success"]
                script_path = exec_result["script_path"]
                
                # Default values to extract from output logs
                metrics = {}
                model_name = "Unknown"
                hyperparameters = {}
                mlflow_run_id = None
                
                # Parse stdout to find JSON metadata block printed by the script
                for line in stdout.split("\n"):
                    clean_line = line.strip()
                    if clean_line.startswith("{") and clean_line.endswith("}"):
                        try:
                            res_data = json.loads(clean_line)
                            if "status" in res_data or "metrics" in res_data:
                                metrics = res_data.get("metrics", {})
                                model_name = res_data.get("model_name", model_name)
                                hyperparameters = res_data.get("hyperparameters", hyperparameters)
                                mlflow_run_id = res_data.get("mlflow_run_id", mlflow_run_id)
                                break
                        except:
                            pass
                
                # Determine metric name & value to save
                metric_name = "accuracy" if task_type == "classification" else "rmse"
                metric_value = metrics.get(metric_name)
                if metric_value is None and metrics:
                    # Take the first available metric if default not found
                    first_key = list(metrics.keys())[0]
                    metric_name = first_key
                    metric_value = metrics[first_key]

                # Copy model pkl file if saved in project dir to prevent overwriting
                model_pkl_name = f"model_proj_{project_id}_run_{next_run_number}.pkl"
                model_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "models")
                os.makedirs(model_dir, exist_ok=True)
                dest_model_path = os.path.join(model_dir, model_pkl_name)
                
                src_model_path = "best_model.pkl"
                saved_model_path = None
                if os.path.exists(src_model_path):
                    try:
                        shutil.move(src_model_path, dest_model_path)
                        saved_model_path = dest_model_path
                    except Exception as ex:
                        print(f"⚠️ Warning: Could not relocate best_model.pkl: {str(ex)}")

                run_status = "completed" if success and metrics else "failed"
                error_message = None if run_status == "completed" else (stderr or "Run completed without parsable metrics.")

                # Save metrics and run data to database
                conn = get_db_connection()
                cursor = conn.cursor()
                try:
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
                            model_name,
                            json.dumps(hyperparameters),
                            metric_name,
                            float(metric_value) if metric_value is not None else None,
                            mlflow_run_id,
                            script_path,
                            saved_model_path,
                            f"--- STDOUT ---\n{stdout}\n\n--- STDERR ---\n{stderr}",
                            run_status,
                            thought,
                            action,
                            error_message,
                        )
                    )
                    run_id = cursor.lastrowid
                    conn.commit()
                    print(f"📊 Run #{next_run_number} recorded in database (Metric: {metric_name} = {metric_value})")
                    log_agent_event(
                        project_id,
                        "run_recorded",
                        f"Run #{next_run_number} recorded with status '{run_status}'.",
                        run_id=run_id,
                        payload={"metric_name": metric_name, "metric_value": metric_value}
                    )
                except Exception as dbe:
                    print(f"❌ Failed to write run data to database: {str(dbe)}")
                    log_agent_event(project_id, "database_error", f"Failed to write run data: {str(dbe)}")
                finally:
                    conn.close()

                next_run_number += 1
                
                # Prepare feedback prompt for next iteration using compiler error loop helper
                if success and metrics:
                    prompt = f"Execution Successful!\nStdout logs:\n{stdout}"
                else:
                    prompt = format_error_feedback(exec_result)

        if terminal_status == "running":
            update_project_status(project_id, "completed")
            log_agent_event(project_id, "optimization_completed", "Optimization loop reached the iteration limit.")
    except Exception as e:
        terminal_status = "failed"
        error_message = str(e)
        update_project_status(project_id, "failed", error_message)
        log_agent_event(project_id, "optimization_failed", error_message)
        raise

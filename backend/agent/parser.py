# backend/agent/parser.py

import json
import re

def clean_and_parse_json(text: str) -> dict:
    """
    Cleans markdown delimiters (like ```json ... ```) from a text string,
    finds the first '{' and last '}', and parses the inner content as JSON.
    """
    if not text:
        raise ValueError("Response text is empty.")
        
    cleaned = text.strip()
    
    # Remove markdown code block markers if present
    # Matches ```json at start and ``` at the end (case-insensitive)
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()
    
    # Find the bounds of the JSON object
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    
    if start_idx == -1 or end_idx == -1 or start_idx > end_idx:
        raise ValueError("No valid JSON object structure found in response.")
        
    json_str = cleaned[start_idx:end_idx + 1]
    
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON decoding failed: {str(e)}\nExtracted block was:\n{json_str}")

def format_error_feedback(exec_result: dict) -> str:
    """
    Analyzes sandbox execution results and creates a structured feedback prompt
    for the AI agent to self-correct in the next step.
    """
    exit_code = exec_result.get("exit_code", 0)
    stderr = exec_result.get("stderr", "").strip()
    stdout = exec_result.get("stdout", "").strip()
    
    # 1. Timeout Case
    if exit_code == -1 or "[TIMEOUT ERROR]" in stderr:
        return (
            "⚠️ EXCURSION WARNING: Your script exceeded the sandboxed timeout limit (45 seconds).\n"
            "This suggests an infinite loop (e.g. while True without break) or excessive training computational load.\n"
            "Please:\n"
            "1. Avoid infinite loops.\n"
            "2. Limit models like RandomForest estimators to fewer n_estimators, or neural nets to 5-10 epochs max.\n"
            "3. Ensure your script terminates cleanly."
        )
        
    # 2. Crash Case (Non-zero exit code)
    if exit_code != 0:
        # Standardize the python traceback message if present
        traceback_msg = stderr if stderr else stdout
        return (
            f"❌ RUNTIME EXCEPTION (Exit Code: {exit_code}): Your code crashed during execution.\n"
            "Here is the console error log and stack trace:\n"
            "--------------------------------------------------\n"
            f"{traceback_msg}\n"
            "--------------------------------------------------\n"
            "Please analyze which line caused this error, double-check your inputs, "
            "verify module imports, and generate a corrected script."
        )
        
    # 3. Successful run, but missing expected metrics printout
    return (
        "ℹ️ RUN COMPLETED but no JSON metrics stdout was captured.\n"
        "Your code ran successfully, but it did not print the final JSON block to stdout.\n"
        "Please ensure the very last lines of your code print a JSON string matching this format EXACTLY:\n"
        'print(json.dumps({"status": "success", "model_name": "ModelName", "hyperparameters": {...}, "metrics": {"accuracy": 0.95}}))'
    )

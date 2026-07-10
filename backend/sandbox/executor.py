import os
import subprocess
import sys
import uuid

# Define the runs directory inside the sandbox folder
SANDBOX_RUNS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs")
os.makedirs(SANDBOX_RUNS_DIR, exist_ok=True)

def execute_code_in_sandbox(code_content: str, timeout_seconds: int = 45) -> dict:
    """
    Writes a string of Python code to a temporary file and executes it 
    as an isolated subprocess. Captures stdout, stderr, and exit code.
    """
    # Generate a unique 8-character ID for this run to prevent filename collisions
    run_id = str(uuid.uuid4())[:8]
    script_filename = f"run_{run_id}.py"
    script_path = os.path.join(SANDBOX_RUNS_DIR, script_filename)

    # Write the AI-generated code to the temporary file
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(code_content)

    # Path to the python interpreter in our virtual environment (venv)
    python_executable = sys.executable

    try:
        # Launch and run the subprocess
        result = subprocess.run(
            [python_executable, script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds
        )
        
        success = (result.returncode == 0)
        return {
            "success": success,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
            "script_path": script_path
        }

    except subprocess.TimeoutExpired as e:
        # Handle infinite loops by capturing whatever was printed before the timeout killed it
        stdout_captured = e.stdout.decode() if isinstance(e.stdout, bytes) else (e.stdout or "")
        stderr_captured = e.stderr.decode() if isinstance(e.stderr, bytes) else (e.stderr or "")
        return {
            "success": False,
            "stdout": stdout_captured,
            "stderr": stderr_captured + f"\n[TIMEOUT ERROR]: Execution exceeded limit of {timeout_seconds}s.",
            "exit_code": -1,
            "script_path": script_path
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"[SANDBOX EXECUTOR ERROR]: {str(e)}",
            "exit_code": -2,
            "script_path": script_path
        }

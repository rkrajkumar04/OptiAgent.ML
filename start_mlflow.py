import subprocess
import sys
import socket
import time

def is_port_open(port):
    """Checks if a local port is already in use (returns True if busy, False if free)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_mlflow_server():
    port = 5000
    if is_port_open(port):
        print(f"Port {port} is already in use. MLflow server might already be running.")
        print(f"Check your browser at: http://localhost:{port}")
        return

    print(f"Starting local MLflow tracking server on port {port}...")
    try:
        # Launch mlflow ui as a background process
        process = subprocess.Popen(
            ["mlflow", "ui", "--port", str(port)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        # Wait a couple of seconds to make sure it loads successfully
        time.sleep(2)
        
        if process.poll() is None:
            print("MLflow Tracking UI successfully started!")
            print(f"Open your web browser and go to: http://localhost:{port}")
            print("Keep this terminal window open to keep the server running, or press Ctrl+C to stop.")
            # Keep monitoring the process
            process.wait()
        else:
            stderr = process.stderr.read()
            print("Failed to start MLflow. Error log:")
            print(stderr)
            
    except FileNotFoundError:
        print("Error: 'mlflow' command not found. Please verify that your python environment has it installed.")
        print("Run: venv/bin/pip install -r requirements.txt")
    except KeyboardInterrupt:
        print("\nStopping MLflow tracking server...")
        process.terminate()
        process.wait()
        print("MLflow tracking server stopped.")

if __name__ == "__main__":
    start_mlflow_server()

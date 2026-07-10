# OptiAgentML — Production Deployment Guide

This guide details the step-by-step instructions to start, configure, and deploy the **OptiAgentML** experiment orchestrator on a local machine or server.

---

## 🏗️ System Architecture

The application consists of four main layers:

```
[ Next.js Frontend ] (Port 3000)
       │
       ▼  (HTTP / API requests)
[ FastAPI Backend ] (Port 8000)
       ├──[ SQLite DB: optima_agent.db ] (Metadata, Runs, Key Settings)
       ├──[ local /uploads ] (Datasets, Serialized .pkl Pipelines)
       ├──[ MLflow Server ] (Port 5000: Model Parameters, Plots, Artifacts)
       └──[ Gemini API Key Rotator ] (Key Rotation Pool via Database or .env)
```

---

## 📋 Prerequisites

Ensure your machine has the following tools installed:
* **Node.js** (v18 or higher)
* **Python** (v3.10 or higher)
* **npm** (v9 or higher)

---

## ⚙️ Environment Configuration

Create a `.env` file in the **root folder** of the project to set up variables:

```bash
# Set Gemini API Keys (comma-separated list for rotation pool)
GEMINI_API_KEYS="AIzaSyYourKey1,AIzaSyYourKey2,AIzaSyYourKey3"

# MLflow configuration
MLFLOW_TRACKING_URI="http://127.0.0.1:5000"
```

---

## 🚀 Startup Instructions (Start Order)

Open four separate terminal windows (or tabs) and execute the services in this exact order:

### Step 1: Start the MLflow Tracking Server
This server logs candidate model parameters and generates visual evaluation charts.
```bash
# From the project root folder:
python3 start_mlflow.py
```
* **Status Check**: Open `http://localhost:5000` in your web browser. You should see the MLflow Experiments board.

### Step 2: Start the FastAPI Backend Server
The backend handles database queries, model training jobs, and Gemini insights generation.
```bash
# Navigate into backend folder:
cd backend

# Run the server using the virtual environment uvicorn:
../venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
* **Status Check**: Open `http://localhost:8000/docs` to view the swagger API documentation.

### Step 3: Compile and Start the Next.js Frontend
For optimal production speed and page loading times:
```bash
# Navigate into frontend folder:
cd frontend

# Install packages (if first run):
npm install

# Compile the production static build:
npm run build

# Start the Next.js production server:
npm run start
```
* **Status Check**: Open `http://localhost:3000` to access the main orchestrator studio dashboard.

---

## 🛠️ Verification Checklist

Once all services are running, verify the setup:
1. **API Key Test**: Go to `/settings` page in the UI and click **"Test Connection"**. You should receive a green `✅ Connection successful! Model responded: "Pong..."` message.
2. **AutoML Run**: Upload a dataset CSV, target column, and click **"Run AutoML"**. Check that candidate trials successfully populate the leaderboard.
3. **MLflow Check**: On `/experiments`, click on a completed run and click **"View Run in MLflow"**. Confirm that the browser redirects to the charts directory and displays the Confusion Matrix or Residuals plot PNG.
4. **AI Insights**: Go to `/dashboard` and click **"💡 AI Insights"** on the project card. Confirm that the panel slides out and displays the markdown recommendation report.

---
*Created by the OptiAgentML Studio team.*

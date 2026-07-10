from typing import Any


def _format_metric(metric_name: str | None, metric_value: Any) -> str:
    if metric_name is None or metric_value is None:
        return "no metric"
    try:
        return f"{metric_name}={float(metric_value):.4f}"
    except (TypeError, ValueError):
        return f"{metric_name}={metric_value}"


def _top_missing_columns(eda_summary: dict[str, Any]) -> list[str]:
    missing_columns = eda_summary.get("missing_columns") or {}
    sorted_items = sorted(missing_columns.items(), key=lambda item: item[1], reverse=True)
    return [f"{column} ({count})" for column, count in sorted_items[:5]]


def build_project_insights(
    project: dict[str, Any],
    eda_summary: dict[str, Any] | None,
    runs: list[dict[str, Any]],
    best_run: dict[str, Any] | None,
) -> dict[str, Any]:
    """Creates free deterministic explanations and recommendations for the dashboard."""
    eda_summary = eda_summary or {}
    metadata = eda_summary.get("metadata") or {}
    role_counts = eda_summary.get("role_counts") or {}
    target = eda_summary.get("target") or {}
    warnings = list(eda_summary.get("warnings") or [])
    missing_total = int(eda_summary.get("missing_total") or 0)
    duplicate_rows = int(eda_summary.get("duplicate_rows") or 0)

    recommendations: list[str] = []
    observations: list[str] = []

    row_count = metadata.get("row_count") or project.get("row_count")
    column_count = metadata.get("column_count") or project.get("column_count")
    task_type = project.get("task_type")

    if row_count and column_count:
        observations.append(f"Dataset has {row_count} rows and {column_count} columns.")

    role_parts = []
    for role in ("numeric", "categorical", "text", "boolean"):
        count = role_counts.get(role, 0)
        if count:
            role_parts.append(f"{count} {role}")
    if role_parts:
        observations.append("Detected feature profile: " + ", ".join(role_parts) + ".")

    if missing_total:
        missing_columns = _top_missing_columns(eda_summary)
        observations.append(f"Dataset has {missing_total} missing values.")
        recommendations.append("Review missing values, especially: " + ", ".join(missing_columns) + ".")
    else:
        observations.append("No missing values were detected in the uploaded dataset.")

    if duplicate_rows:
        recommendations.append(f"Consider removing {duplicate_rows} duplicate rows before final training.")

    if target.get("unique_count") is not None:
        observations.append(
            f"Target column '{project.get('target_column')}' has {target.get('unique_count')} unique values."
        )

    recommendations.extend(warnings)

    completed_runs = [run for run in runs if run.get("status") == "completed" and run.get("metric_value") is not None]
    backend_runs = [run for run in completed_runs if run.get("action") == "backend_automl"]

    if best_run:
        observations.append(
            f"Best model so far is {best_run.get('model_name')} with "
            f"{_format_metric(best_run.get('metric_name'), best_run.get('metric_value'))}."
        )
    else:
        recommendations.append("Run backend AutoML to create a baseline leaderboard.")

    if task_type == "classification":
        recommendations.append("Compare accuracy with weighted F1 before trusting the final classifier.")
        if backend_runs:
            recommendations.append("If classes are imbalanced, inspect precision and recall from each backend AutoML run.")
    elif task_type == "regression":
        recommendations.append("Prefer lower RMSE, but also inspect MAE and R2 for business interpretability.")
        if backend_runs:
            recommendations.append("Try feature engineering if linear models and tree models have very different RMSE.")

    if len(completed_runs) < 2:
        recommendations.append("Train at least two candidate models before selecting a final model.")

    return {
        "summary": " ".join(observations),
        "observations": observations,
        "recommendations": recommendations,
        "best_model": best_run,
        "run_counts": {
            "total": len(runs),
            "completed": len(completed_runs),
            "backend_automl": len(backend_runs),
        },
    }

def generate_gemini_insights(project: dict[str, Any], eda_summary: dict[str, Any] | None, runs: list[dict[str, Any]]) -> str:
    """Uses Gemini via Key Rotation pool to write a premium Data Science evaluation report."""
    import google.generativeai as genai
    from agent.rotation import ApiKeyRotator
    
    completed_runs = [r for r in runs if r.get("status") == "completed" and r.get("metric_value") is not None]
    if not completed_runs:
        return "💡 *No trial runs have completed yet. Run baseline AutoML to generate insights.*"

    # Construct clean leaderboard summary
    leaderboard = []
    for run in completed_runs:
        leaderboard.append(
            f"- Run #{run.get('run_number')}: {run.get('model_name')} | "
            f"Score: {run.get('metric_name')}={run.get('metric_value'):.4f} | "
            f"Thought: {run.get('thought')}"
        )
    leaderboard_str = "\n".join(leaderboard)

    # Construct columns list
    eda = eda_summary or {}
    columns_meta = eda.get("columns", [])
    feature_cols = [f"{c['name']} ({c.get('role', 'numeric')})" for c in columns_meta if not c.get("is_target")]
    features_str = ", ".join(feature_cols)

    prompt = f"""
    You are an expert Senior Principal Data Scientist reviewing an automated ML experiment.
    Write a highly detailed, professional, and actionable evaluation report based on the following project context.

    PROJECT DETAILS:
    - Name: {project.get('name')}
    - Task Type: {project.get('task_type')}
    - Target Column: {project.get('target_column')}
    - Feature Columns: {features_str}
    - Dataset Dimensions: {project.get('row_count', 'unknown')} rows, {project.get('column_count', 'unknown')} columns
    - Missing Values Count: {eda.get('missing_total', 0)}
    - Duplicate Rows: {eda.get('duplicate_rows', 0)}

    TRIAL RUNS LEADERBOARD:
    {leaderboard_str}

    INSTRUCTIONS:
    Write a structured markdown report containing:
    1. **Executive Analysis**: Summary of the overall experiment. Mention the best-performing model, whether the score is high/low, and if there are immediate warnings (e.g. high missing values).
    2. **Model Performance Breakdown**: Explain WHY the winning model succeeded and why others failed based on the features profile (e.g. tree models vs linear models on numeric vs categorical data).
    3. **Actionable Next-Step Recommendations**: 3 to 4 specific data science recommendations to improve performance (e.g. feature engineering, log scaling numeric features, hyperparameter ranges to try, or handling class imbalance).

    FORMATTING RULES:
    - Use clear headers, bold text, and bullet points.
    - Write in a professional, constructive, and authorative tone.
    - Do NOT include generic advice; tailor it directly to the features list and scores above.
    """

    try:
        rotator = ApiKeyRotator()
        
        def run_call():
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = model.generate_content(prompt)
            return response.text.strip()
            
        return rotator.execute_with_rotation(run_call)
    except Exception as e:
        return f"⚠️ *Failed to generate AI insights: {str(e)}*"


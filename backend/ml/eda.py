import math
from typing import Any

import pandas as pd


MAX_PROFILE_COLUMNS = 80
MAX_TARGET_CLASSES = 25


def _clean_value(value: Any) -> Any:
    """Converts pandas/numpy values into JSON-safe Python values."""
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def _detect_column_role(series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    non_null = series.dropna().astype(str)
    if non_null.empty:
        return "categorical"
    avg_length = non_null.str.len().mean()
    unique_ratio = non_null.nunique() / max(len(non_null), 1)
    if avg_length >= 30 or unique_ratio > 0.7:
        return "text"
    return "categorical"


def analyze_csv_dataset(csv_path: str, target_column: str, task_type: str) -> dict[str, Any]:
    """
    Validates a CSV dataset and returns a compact EDA summary for storage/API use.
    This module is deterministic and does not call Gemini.
    """
    if task_type not in ("classification", "regression"):
        raise ValueError("task_type must be either 'classification' or 'regression'.")

    try:
        df = pd.read_csv(csv_path)
    except Exception as exc:
        raise ValueError(f"Could not read CSV file: {exc}") from exc

    if df.empty:
        raise ValueError("CSV file is empty.")

    if target_column not in df.columns:
        available = ", ".join(map(str, df.columns[:20]))
        raise ValueError(f"Target column '{target_column}' was not found. Available columns: {available}")

    if len(df.columns) < 2:
        raise ValueError("Dataset must contain at least one feature column and one target column.")

    target = df[target_column]
    if target.dropna().empty:
        raise ValueError("Target column has no usable non-empty values.")

    warnings: list[str] = []
    if task_type == "regression" and not pd.api.types.is_numeric_dtype(target):
        raise ValueError("Regression target column must be numeric.")

    if task_type == "classification":
        unique_targets = target.dropna().nunique()
        if unique_targets > max(50, int(len(df) * 0.5)):
            warnings.append(
                "Target has many unique values for classification. Confirm this is not a regression task."
            )

    missing_counts = df.isna().sum()
    duplicate_rows = int(df.duplicated().sum())
    profile_columns = list(df.columns[:MAX_PROFILE_COLUMNS])

    columns: list[dict[str, Any]] = []
    role_counts = {"numeric": 0, "categorical": 0, "text": 0, "boolean": 0}
    for column in profile_columns:
        series = df[column]
        role = _detect_column_role(series)
        role_counts[role] = role_counts.get(role, 0) + 1
        columns.append(
            {
                "name": str(column),
                "dtype": str(series.dtype),
                "role": role,
                "missing_count": int(missing_counts[column]),
                "missing_percent": round(float(missing_counts[column] / len(df) * 100), 2),
                "unique_count": int(series.nunique(dropna=True)),
                "is_target": column == target_column,
            }
        )

    target_counts = target.value_counts(dropna=False).head(MAX_TARGET_CLASSES)
    target_summary = {
        "column": target_column,
        "dtype": str(target.dtype),
        "missing_count": int(target.isna().sum()),
        "unique_count": int(target.nunique(dropna=True)),
        "sample_distribution": {
            str(_clean_value(index)): int(value)
            for index, value in target_counts.items()
        },
    }

    if task_type == "regression":
        target_summary["stats"] = {
            "min": _clean_value(target.min()),
            "max": _clean_value(target.max()),
            "mean": _clean_value(target.mean()),
            "median": _clean_value(target.median()),
        }

    metadata = {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "feature_count": int(len(df.columns) - 1),
        "target_column": target_column,
        "task_type": task_type,
    }

    # Calculate Correlation Heatmap for Numeric columns
    num_cols = [c["name"] for c in columns if c["role"] == "numeric" and not c["is_target"]]
    num_cols = [c for c in num_cols if not any(kw in c.lower() for kw in ["rownumber", "customerid", "id", "index", "surname", "name", "transaction_id", "unnamed"])]
    use_cols = num_cols[:5]
    
    # Try mapping classification targets to int to include in matrix
    target_series = df[target_column]
    if pd.api.types.is_numeric_dtype(target_series):
        use_cols = use_cols + [target_column]
    else:
        df["_target_encoded"] = pd.factorize(target_series)[0]
        use_cols = use_cols + ["_target_encoded"]
        df = df.rename(columns={"_target_encoded": f"{target_column}_encoded"})

    correlation_heatmap = {"features": [], "matrix": []}
    try:
        if use_cols:
            corr = df[use_cols].corr().fillna(0.0)
            correlation_heatmap = {
                "features": list(corr.columns),
                "matrix": corr.values.tolist()
            }
    except Exception as e:
        print(f"⚠️ Failed to calculate correlation heatmap: {e}")

    eda_summary = {
        "metadata": metadata,
        "columns": columns,
        "role_counts": role_counts,
        "missing_total": int(missing_counts.sum()),
        "missing_columns": {
            str(column): int(count)
            for column, count in missing_counts.items()
            if int(count) > 0
        },
        "duplicate_rows": duplicate_rows,
        "target": target_summary,
        "warnings": warnings,
        "correlation_heatmap": correlation_heatmap
    }

    return {
        "metadata": metadata,
        "eda_summary": eda_summary,
    }

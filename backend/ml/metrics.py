import math
from typing import Any

from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)


def _clean_metric(value: Any) -> float:
    value = float(value)
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return value


def evaluate_classification(y_true, y_pred) -> dict[str, float]:
    return {
        "accuracy": _clean_metric(accuracy_score(y_true, y_pred)),
        "f1_score": _clean_metric(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        "precision": _clean_metric(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
        "recall": _clean_metric(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
    }


def evaluate_regression(y_true, y_pred) -> dict[str, float]:
    mse = mean_squared_error(y_true, y_pred)
    return {
        "rmse": _clean_metric(math.sqrt(mse)),
        "mae": _clean_metric(mean_absolute_error(y_true, y_pred)),
        "r2_score": _clean_metric(r2_score(y_true, y_pred)),
    }


def primary_metric(task_type: str, metrics: dict[str, float]) -> tuple[str, float]:
    if task_type == "classification":
        return "accuracy", metrics["accuracy"]
    return "rmse", metrics["rmse"]


def is_better(task_type: str, candidate: float | None, current: float | None) -> bool:
    if candidate is None:
        return False
    if current is None:
        return True
    if task_type == "regression":
        return candidate < current
    return candidate > current

def generate_confusion_matrix_plot(y_true, y_pred, labels=None) -> str:
    """Generates a confusion matrix PNG in a headless plot environment."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
    import tempfile
    import os

    fig, ax = plt.subplots(figsize=(6, 5))
    cm = confusion_matrix(y_true, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=labels)
    disp.plot(cmap="Blues", values_format="d", ax=ax)
    plt.title("Confusion Matrix")
    
    temp_dir = tempfile.gettempdir()
    plot_path = os.path.join(temp_dir, "confusion_matrix.png")
    plt.savefig(plot_path, bbox_inches="tight", dpi=100)
    plt.close(fig)
    return plot_path

def generate_residuals_plot(y_true, y_pred) -> str:
    """Generates a residuals plot PNG in a headless plot environment."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import tempfile
    import os

    fig, ax = plt.subplots(figsize=(6, 5))
    residuals = y_true - y_pred
    ax.scatter(y_pred, residuals, alpha=0.6, color="#00dbe9")
    ax.axhline(y=0, color="#ebb2ff", linestyle="--", linewidth=1.2)
    ax.set_xlabel("Predicted Values")
    ax.set_ylabel("Residuals")
    plt.title("Residuals Plot")
    
    temp_dir = tempfile.gettempdir()
    plot_path = os.path.join(temp_dir, "residuals_plot.png")
    plt.savefig(plot_path, bbox_inches="tight", dpi=100)
    plt.close(fig)
    return plot_path


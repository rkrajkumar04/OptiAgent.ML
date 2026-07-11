import os
from dataclasses import dataclass

import pandas as pd
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.svm import LinearSVC

from ml.metrics import evaluate_classification, evaluate_regression, primary_metric
from ml.preprocessing import build_preprocessor, infer_feature_roles


RANDOM_STATE = 42


@dataclass
class ModelResult:
    model_name: str
    pipeline: Pipeline
    metrics: dict[str, float]
    metric_name: str
    metric_value: float
    hyperparameters: dict


def _candidate_models(task_type: str, has_text: bool):
    is_render = os.environ.get("RENDER") is not None
    n_est = 10 if is_render else 50
    gb_est = 10 if is_render else 40

    if task_type == "classification":
        models = [
            ("Logistic Regression", LogisticRegression(max_iter=200, class_weight="balanced")),
            ("Linear SVC", LinearSVC(dual="auto", class_weight="balanced", random_state=RANDOM_STATE)),
        ]
        if not has_text:
            models.extend(
                [
                    ("Random Forest Classifier", RandomForestClassifier(n_estimators=n_est, max_depth=6 if is_render else 10, n_jobs=1, random_state=RANDOM_STATE)),
                    ("Gradient Boosting Classifier", GradientBoostingClassifier(n_estimators=gb_est, max_depth=3 if is_render else 4, random_state=RANDOM_STATE)),
                ]
            )
        return models

    models = [
        ("Ridge Regression", Ridge()),
    ]
    if not has_text:
        models.extend(
            [
                ("Random Forest Regressor", RandomForestRegressor(n_estimators=n_est, max_depth=6 if is_render else 10, n_jobs=1, random_state=RANDOM_STATE)),
                ("Linear Regression", LinearRegression()),
                ("Gradient Boosting Regressor", GradientBoostingRegressor(n_estimators=gb_est, max_depth=3 if is_render else 4, random_state=RANDOM_STATE)),
            ]
        )
    return models


def _split_data(X: pd.DataFrame, y, task_type: str):
    test_size = 0.3 if len(X) < 50 else 0.2
    stratify = None

    if task_type == "classification":
        value_counts = pd.Series(y).value_counts()
        if len(value_counts) > 1 and value_counts.min() >= 2:
            stratify = y

    return train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=RANDOM_STATE,
        stratify=stratify,
    )


def train_candidate_models(csv_path: str, target_column: str, task_type: str, selected_models: str = None) -> list[ModelResult]:
    df = pd.read_csv(csv_path)
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found.")

    df = df.dropna(subset=[target_column]).copy()
    if len(df) < 5:
        raise ValueError("Dataset needs at least 5 usable rows for train/test evaluation.")

    if task_type == "classification":
        num_classes = df[target_column].nunique()
        if num_classes > 50:
            raise ValueError(
                f"Target column '{target_column}' has {num_classes} unique classes. "
                "For classification, the target column must have 50 or fewer unique categories. "
                "Please choose a different target column, or use a numeric target for regression."
            )

    # Infer feature roles first so we can identify text columns
    roles = infer_feature_roles(df, target_column)

    # Automatically identify and drop irrelevant identifier columns
    useless_cols = []
    for col in df.columns:
        if col == target_column:
            continue
        col_lower = col.lower()
        if any(kw in col_lower for kw in ["rownumber", "customerid", "id", "index", "surname", "name", "transaction_id", "unnamed"]):
            useless_cols.append(col)
        elif col in roles.categorical and df[col].nunique() / len(df) > 0.95:
            useless_cols.append(col)

    if useless_cols:
        df = df.drop(columns=useless_cols)
        print(f"🧹 Automatically dropped useless columns during training: {useless_cols}")
        # Recalculate feature roles after dropping columns
        roles = infer_feature_roles(df, target_column)

    X = df.drop(columns=[target_column])
    y = df[target_column]

    label_encoder = None
    if task_type == "classification":
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y.astype(str))

    preprocessor = build_preprocessor(roles)
    X_train, X_test, y_train, y_test = _split_data(X, y, task_type)

    # Check if we are running in the cloud (Render) to trigger hyper-fast execution
    is_render = os.environ.get("RENDER") is not None
    max_train_size = 150 if is_render else 2000
    max_test_size = 50 if is_render else 1000

    if len(X_train) > max_train_size:
        try:
            stratify = y_train if task_type == "classification" else None
            X_train, _, y_train, _ = train_test_split(
                X_train, y_train, train_size=max_train_size, random_state=RANDOM_STATE, stratify=stratify
            )
        except Exception:
            # Fallback to random sample without stratification if it fails
            X_train, _, y_train, _ = train_test_split(
                X_train, y_train, train_size=max_train_size, random_state=RANDOM_STATE, stratify=None
            )

    if len(X_test) > max_test_size:
        try:
            stratify = y_test if task_type == "classification" else None
            X_test, _, y_test, _ = train_test_split(
                X_test, y_test, train_size=max_test_size, random_state=RANDOM_STATE, stratify=stratify
            )
        except Exception:
            X_test, _, y_test, _ = train_test_split(
                X_test, y_test, train_size=max_test_size, random_state=RANDOM_STATE, stratify=None
            )

    # Filter candidate models based on requested selection
    candidate_list = _candidate_models(task_type, has_text=bool(roles.text))
    if selected_models:
        selected_names = [s.strip().lower() for s in selected_models.split(",") if s.strip()]
        filtered_candidates = [
            (name, est) for name, est in candidate_list
            if any(sel in name.lower() for sel in selected_names)
        ]
        # Fallback if filtering returns empty set
        if filtered_candidates:
            candidate_list = filtered_candidates

    results: list[ModelResult] = []
    for model_name, estimator in candidate_list:
        pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("model", estimator),
            ]
        )
        pipeline.fit(X_train, y_train)
        predictions = pipeline.predict(X_test)

        if task_type == "classification":
            metrics = evaluate_classification(y_test, predictions)
            
            # 1. Confusion Matrix Calculations (TN, FP, FN, TP)
            from sklearn.metrics import confusion_matrix
            tn, fp, fn, tp = 0, 0, 0, 0
            try:
                cm = confusion_matrix(y_test, predictions)
                if cm.size == 4:
                    tn, fp, fn, tp = [int(x) for x in cm.ravel()]
                else:
                    # Multi-class dataset (e.g. Iris): Binarize to Class 0 vs Rest
                    import numpy as np
                    y_test_bin = (y_test != 0).astype(int)
                    predictions_bin = (predictions != 0).astype(int)
                    cm_bin = confusion_matrix(y_test_bin, predictions_bin)
                    if cm_bin.size == 4:
                        tn, fp, fn, tp = [int(x) for x in cm_bin.ravel()]
                    else:
                        tn = int(cm_bin[0, 0])
            except Exception:
                pass
            metrics["tn"] = tn
            metrics["fp"] = fp
            metrics["fn"] = fn
            metrics["tp"] = tp

            # 2. ROC Curve points calculations
            roc_points = []
            roc_auc = 0.0
            from sklearn.metrics import roc_curve, auc
            try:
                import numpy as np
                y_test_bin = (y_test != 0).astype(int)
                
                probs = None
                if hasattr(pipeline, "predict_proba"):
                    probs_matrix = pipeline.predict_proba(X_test)
                    if probs_matrix.shape[1] > 1:
                        # Probability of any class other than class 0
                        probs = 1.0 - probs_matrix[:, 0]
                    else:
                        probs = probs_matrix[:, 0]
                elif hasattr(pipeline, "decision_function"):
                    dec_func = pipeline.decision_function(X_test)
                    if len(dec_func.shape) > 1:
                        # Max decision values for positive classes
                        probs = dec_func[:, 1:].max(axis=1)
                    else:
                        probs = dec_func

                if probs is not None:
                    fpr, tpr, _ = roc_curve(y_test_bin, probs)
                    roc_auc = float(auc(fpr, tpr))
                    # Downsample to 10 points
                    step = max(1, len(fpr) // 10)
                    for idx in range(0, len(fpr), step):
                        roc_points.append({"fpr": float(fpr[idx]), "tpr": float(tpr[idx])})
                    if not roc_points or roc_points[-1]["fpr"] != 1.0 or roc_points[-1]["tpr"] != 1.0:
                        roc_points.append({"fpr": 1.0, "tpr": 1.0})
            except Exception as e:
                print(f"⚠️ Failed to compute ROC points: {e}")
                
            metrics["roc_auc"] = roc_auc
            metrics["roc_points"] = roc_points



        else:
            metrics = evaluate_regression(y_test, predictions)

        metric_name, metric_value = primary_metric(task_type, metrics)

        # 3. Feature Importance calculation
        feature_importances = {}
        try:
            model = pipeline.named_steps["model"]
            importances = None
            if hasattr(model, "feature_importances_"):
                importances = model.feature_importances_
            elif hasattr(model, "coef_"):
                importances = model.coef_
                if len(importances.shape) > 1:
                    importances = importances[0]
                importances = [abs(float(x)) for x in importances]

            if importances is not None:
                orig_features = roles.numeric + roles.categorical + roles.text
                num_len = len(roles.numeric)
                for i, feat in enumerate(roles.numeric):
                    if i < len(importances):
                        feature_importances[feat] = float(importances[i])
                
                cat_text_cols = roles.categorical + roles.text
                if cat_text_cols and len(importances) > num_len:
                    rem_sum = float(sum(importances[num_len:]))
                    share = rem_sum / len(cat_text_cols)
                    for col in cat_text_cols:
                        feature_importances[col] = share
        except Exception:
            pass

        # Normalize feature importances to sum to 1.0 (or percentage)
        if feature_importances:
            total_imp = sum(feature_importances.values())
            if total_imp > 0:
                feature_importances = {k: (v / total_imp) for k, v in feature_importances.items()}

        hyperparameters = {
            "source": "backend_automl",
            "model_type": model_name,
            "feature_roles": {
                "numeric": roles.numeric,
                "categorical": roles.categorical,
                "text": roles.text,
            },
            "metrics": metrics,
            "feature_importances": feature_importances
        }
        if label_encoder is not None:
            hyperparameters["target_classes"] = list(label_encoder.classes_)

        results.append(
            ModelResult(
                model_name=model_name,
                pipeline=pipeline,
                metrics=metrics,
                metric_name=metric_name,
                metric_value=metric_value,
                hyperparameters=hyperparameters,
            )
        )

    return results



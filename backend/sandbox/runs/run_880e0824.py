import pandas as pd
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
import joblib
import mlflow
import mlflow.sklearn
import numpy as np
import json
import os

# Define constants
DATASET_PATH = '/Users/rajkumarsharma/Desktop/ Ml_Experiment_Orchestrator /spam_dataset.csv'
TARGET_COLUMN = 'label'
TEXT_COLUMN = 'text' # Assuming 'text' is the column containing the message content

# Set MLflow experiment
mlflow.set_experiment("OptiAgentML_Experiment")

with mlflow.start_run():
    # 1. Load the dataset
    df = pd.read_csv(DATASET_PATH, encoding='latin-1')
    
    # Drop unnamed columns often created during CSV export/import
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]

    # Rename columns for consistency, assuming common spam dataset structure
    if 'v1' in df.columns and 'v2' in df.columns:
        df = df.rename(columns={'v1': 'label', 'v2': 'text'})

    # Ensure the text column exists
    if TEXT_COLUMN not in df.columns:
        raise ValueError(f"Text column '{TEXT_COLUMN}' not found in the dataset. Available columns: {df.columns.tolist()}")
    
    # 2. Preprocessing
    # Handle missing values in text column by filling with empty string
    df[TEXT_COLUMN] = df[TEXT_COLUMN].fillna('')

    # Encode target variable
    label_encoder = LabelEncoder()
    df[TARGET_COLUMN] = label_encoder.fit_transform(df[TARGET_COLUMN])
    
    # Check for class imbalance (optional for now, but good to know)
    class_counts = df[TARGET_COLUMN].value_counts(normalize=True)
    mlflow.log_param("target_class_distribution", class_counts.to_dict())
    print(f"Target class distribution:\n{class_counts}")

    # 3. Split the dataset
    X = df[TEXT_COLUMN]
    y = df[TARGET_COLUMN]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 4. Create a Pipeline with TfidfVectorizer and LogisticRegression
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(stop_words='english')),
        ('clf', LogisticRegression(solver='liblinear', random_state=42, class_weight='balanced')) # Use class_weight='balanced' to handle potential imbalance
    ])

    # 5. Hyperparameter Tuning using RandomizedSearchCV
    param_dist = {
        'tfidf__max_features': [5000, 10000, 20000, None],
        'tfidf__ngram_range': [(1, 1), (1, 2)],
        'clf__C': np.logspace(-3, 3, 7),
        'clf__penalty': ['l1', 'l2']
    }

    random_search = RandomizedSearchCV(
        pipeline,
        param_distributions=param_dist,
        n_iter=10, # Number of parameter settings that are sampled
        cv=5,
        scoring='f1_weighted',
        random_state=42,
        n_jobs=-1,
        verbose=1
    )

    random_search.fit(X_train, y_train)

    best_model = random_search.best_estimator_
    best_params = random_search.best_params_
    
    print(f"Best parameters found: {best_params}")

    # 6. Log hyperparameters with MLflow
    mlflow.log_param("model_type", "LogisticRegression_with_TFIDF")
    mlflow.log_params(best_params)

    # 7. Evaluate the best model
    y_pred = best_model.predict(X_test)
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average='weighted')
    recall = recall_score(y_test, y_pred, average='weighted')
    f1 = f1_score(y_test, y_pred, average='weighted')

    metrics = {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1
    }
    
    print(f"Model Metrics: {metrics}")

    # Log metrics with MLflow
    mlflow.log_metrics(metrics)

    # 8. Save the final trained model
    model_filename = 'best_model.pkl'
    joblib.dump(best_model, model_filename)
    mlflow.log_artifact(model_filename)

    # 9. Print JSON output
    print(json.dumps({"status": "success", "metrics": metrics}))

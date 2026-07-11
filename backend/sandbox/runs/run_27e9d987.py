import pandas as pd
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
import pickle
import json
import numpy as np
import sys

# Dataset path and target column (provided by the orchestrator)
dataset_path = '/Users/rajkumarsharma/Desktop/ Ml_Experiment_Orchestrator /spam_dataset.csv'
target_column = 'label'
text_column = 'text' # Assuming 'text' is the column containing text data based on common spam datasets

try:
    # Load dataset
    df = pd.read_csv(dataset_path)

    # Check if 'text_column' exists, if not, try common alternatives
    if text_column not in df.columns:
        common_text_cols = ['message', 'sms', 'email_content', 'content']
        found_text_col = False
        for col in common_text_cols:
            if col in df.columns:
                text_column = col
                found_text_col = True
                break
        if not found_text_col:
            raise ValueError(f"Could not find a suitable text column. Looked for '{text_column}' and common alternatives: {common_text_cols}.")
    
    # Ensure target column exists
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in the dataset.")

    # Handle missing values - for text, replace NaN with empty string
    if df[text_column].isnull().any():
        df[text_column] = df[text_column].fillna('')

    # Encode target variable if it's categorical (e.g., 'spam', 'ham')
    le = LabelEncoder()
    df[target_column] = le.fit_transform(df[target_column])

    X = df[text_column]
    y = df[target_column]

    # Check for class imbalance
    class_counts = y.value_counts()
    # Simple check for imbalance: if min count is less than 20% of max count, consider it imbalanced
    imbalance_ratio = class_counts.min() / class_counts.max() if class_counts.max() > 0 else 1.0
    is_imbalanced = imbalance_ratio < 0.2

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Create a pipeline with TF-IDF Vectorizer and Logistic Regression
    model_params = {}
    if is_imbalanced:
        model_params['logisticregression__class_weight'] = 'balanced'
        # print("Class imbalance detected, applying class_weight='balanced'.")

    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer()),
        ('logisticregression', LogisticRegression(solver='liblinear', random_state=42))
    ])

    # Hyperparameter tuning using RandomizedSearchCV
    param_distributions = {
        'tfidf__max_features': [10000, 20000, None],
        'tfidf__ngram_range': [(1, 1), (1, 2)],
        'logisticregression__C': np.logspace(-3, 0, 4),
        'logisticregression__penalty': ['l1', 'l2']
    }

    random_search = RandomizedSearchCV(
        pipeline,
        param_distributions,
        n_iter=5, # Reduced for speed
        cv=3,     # Reduced for speed
        scoring='f1_weighted', # Use f1-score weighted for classification, especially with imbalance
        random_state=42,
        n_jobs=-1, # Use all available cores
        verbose=0
    )

    random_search.fit(X_train, y_train)

    best_model = random_search.best_estimator_

    # Make predictions
    y_pred = best_model.predict(X_test)

    # Evaluate the model
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='weighted')

    # Save the best model
    with open('best_model.pkl', 'wb') as f:
        pickle.dump(best_model, f)

    # Prepare results for JSON output
    results = {
        "status": "success",
        "metrics": {
            "accuracy": accuracy,
            "f1_score": f1
        }
    }

    print(json.dumps(results))

except Exception as e:
    # In case of any error, print an error message to stderr and exit
    print(json.dumps({"status": "error", "message": str(e)}), file=sys.stderr)
    sys.exit(1)

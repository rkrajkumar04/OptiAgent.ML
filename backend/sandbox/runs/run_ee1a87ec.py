import pandas as pd
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.preprocessing import LabelEncoder, StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
import pickle
import json
import numpy as np
import sys

# Dataset path and target column
dataset_path = '/Users/rajkumarsharma/Desktop/ Ml_Experiment_Orchestrator /spam_dataset.csv'
target_column = 'label'

try:
    # Load dataset
    df = pd.read_csv(dataset_path)

    # --- Initial Data Inspection ---
    # print("\n--- DataFrame Head ---")
    # print(df.head())
    # print("\n--- DataFrame Info ---")
    # print(df.info())
    # print("\n--- DataFrame Describe ---")
    # print(df.describe(include='all'))
    # print("\n--- DataFrame Columns ---")
    # print(df.columns)

    # Ensure target column exists
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in the dataset.")

    # Separate target variable
    y = df[target_column]
    X = df.drop(columns=[target_column])

    # Encode target variable if it's categorical
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    # --- Feature Type Identification ---
    numerical_cols = X.select_dtypes(include=np.number).columns.tolist()
    categorical_cols = X.select_dtypes(include='object').columns.tolist()

    # Heuristic to identify a 'text' column: check for columns with many unique string values
    text_column_name = None
    for col in categorical_cols:
        # Exclude columns that might be true categories but have many unique values like IDs
        # Consider a column as 'text' if it has a high number of unique values AND its values are primarily strings/objects.
        if X[col].dtype == 'object' and X[col].nunique() > 0.5 * len(X) and X[col].astype(str).apply(len).mean() > 20: # Average length heuristic
            text_column_name = col
            break
    
    # Fallback to common text column names if heuristic fails or dataset is small
    if text_column_name is None:
        common_text_cols = ['text', 'message', 'sms', 'email_content', 'content']
        for col in common_text_cols:
            if col in X.columns:
                text_column_name = col
                break

    # Remove text_column from categorical_cols if identified
    if text_column_name and text_column_name in categorical_cols:
        categorical_cols.remove(text_column_name)

    # --- Preprocessing Pipelines for ColumnTransformer ---
    # Numerical pipeline
    numerical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    # Categorical pipeline
    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ])

    # Text pipeline
    text_transformer = Pipeline(steps=[
        ('tfidf', TfidfVectorizer(max_features=20000, ngram_range=(1,2)))
    ])
    
    # Create preprocessor with ColumnTransformer
    preprocessor_steps = []
    if numerical_cols: # Only add if numerical columns exist
        preprocessor_steps.append(('num', numerical_transformer, numerical_cols))
    if categorical_cols: # Only add if categorical columns exist
        preprocessor_steps.append(('cat', categorical_transformer, categorical_cols))
    if text_column_name: # Only add if a text column was identified
        preprocessor_steps.append(('text', text_transformer, text_column_name))
    
    preprocessor = ColumnTransformer(
        transformers=preprocessor_steps, 
        remainder='passthrough' # Keep other columns (e.g., if some were missed or are just IDs)
    )

    # --- Check for Class Imbalance ---
    class_counts = pd.Series(y_encoded).value_counts()
    imbalance_ratio = class_counts.min() / class_counts.max() if class_counts.max() > 0 else 1.0
    is_imbalanced = imbalance_ratio < 0.2

    # --- Model Definition ---
    model_params = {}
    if is_imbalanced:
        model_params['logisticregression__class_weight'] = 'balanced'
        # print("Class imbalance detected, applying class_weight='balanced'.")

    # Create the full pipeline
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('logisticregression', LogisticRegression(solver='liblinear', random_state=42))
    ])

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded)

    # Hyperparameter tuning using RandomizedSearchCV
    param_distributions = {
        'preprocessor__text__tfidf__max_features': [10000, 20000, None] if text_column_name else [],
        'preprocessor__text__tfidf__ngram_range': [(1, 1), (1, 2)] if text_column_name else [],
        'logisticregression__C': np.logspace(-3, 0, 4),
        'logisticregression__penalty': ['l1', 'l2']
    }

    # Filter out empty parameter distributions if text_column_name is None
    param_distributions = {k: v for k, v in param_distributions.items() if v}

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

    # Fit the random search to the data
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

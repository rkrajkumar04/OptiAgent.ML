import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score
import json
import pickle
import logging

# Configure logging to suppress verbose output from libraries
logging.basicConfig(level=logging.WARNING)

# Dataset path and target column
DATASET_PATH = '/Users/rajkumarsharma/Desktop/ Ml_Experiment_Orchestrator /spam_dataset.csv'
TARGET_COLUMN = 'label'

try:
    # 1. Load the dataset
    df = pd.read_csv(DATASET_PATH)

    # 2. Inspect dataset characteristics and preprocess robustly
    
    # Check for missing values - Simple imputation for non-text columns if any
    # For this dataset, assuming 'text' and 'label' are the primary columns and are clean
    # If there were numerical columns, we'd impute them.
    # For text, generally, missing values might be treated as empty strings or dropped.
    df.dropna(subset=[TARGET_COLUMN], inplace=True)
    
    # Identify the text column. Assuming 'text' based on common spam datasets.
    # We'll try to find a column that is not the target and is of object/string type.
    text_column = None
    for col in df.columns:
        if col != TARGET_COLUMN and df[col].dtype == 'object':
            # Simple heuristic: pick the first non-target object column as text
            text_column = col
            break
    
    if text_column is None:
        # Fallback or error if no suitable text column is found
        # For now, let's assume 'text' is present. If not, the TF-IDF step will error.
        # A more robust approach would be to analyze content, but for this step, a direct pick is faster.
        # Let's assume the dataset structure is consistent and 'text' is the feature.
        # If 'text_column' wasn't found by the loop, this might be a problem.
        # Let's enforce 'text' as a reasonable default for spam datasets.
        if 'text' in df.columns:
            text_column = 'text'
        else:
            raise ValueError("Could not identify a suitable text column. Expected 'text' or similar.")

    # Handle missing values in the text column by filling with empty strings
    df[text_column] = df[text_column].fillna('')

    # Encode target variable
    le = LabelEncoder()
    df[TARGET_COLUMN] = le.fit_transform(df[TARGET_COLUMN])
    
    # Define features (X) and target (y)
    X = df[text_column]
    y = df[TARGET_COLUMN]
    
    # Check for class imbalance
    class_counts = y.value_counts()
    minority_class_percentage = class_counts.min() / class_counts.sum() * 100
    
    # Set class_weight='balanced' if there's significant imbalance (e.g., < 20% for minority class)
    class_weight_param = None
    if minority_class_percentage < 20:
        print(f"Minority class percentage: {minority_class_percentage:.2f}%. Applying class_weight='balanced'.")
        class_weight_param = 'balanced'
    else:
        print(f"Class distribution seems balanced. Minority class percentage: {minority_class_percentage:.2f}%. No class_weight adjustment.")

    # 3. Split the dataset into train and test sets (80/20 split)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 4. Select and train a machine learning model
    # Using a Pipeline for TF-IDF Vectorization and Logistic Regression
    model_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=5000)), # Limiting features for speed
        ('classifier', LogisticRegression(random_state=42, solver='liblinear', class_weight=class_weight_param, max_iter=200)) # Increased max_iter for convergence
    ])

    print("Starting model training...")
    model_pipeline.fit(X_train, y_train)
    print("Model training complete.")

    # 5. Make predictions and evaluate
    y_pred = model_pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='weighted') # Use weighted for multi-class or imbalanced binary

    # 6. Save the final trained model
    model_filename = 'best_model.pkl'
    with open(model_filename, 'wb') as file:
        pickle.dump(model_pipeline, file)
    print(f"Model saved to {model_filename}")

    # Print metrics in JSON format
    results = {"status": "success", "metrics": {"accuracy": accuracy, "f1_score": f1}}
    print(json.dumps(results))

except Exception as e:
    # Log the exception for debugging
    logging.error(f"An error occurred during model training: {e}", exc_info=True)
    # If the script fails, it should raise an exception, which will be caught by the orchestrator.
    raise

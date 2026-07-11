import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
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
    
    df.dropna(subset=[TARGET_COLUMN], inplace=True)
    
    # Identify the text column. Assuming 'text' based on common spam datasets.
    text_column = None
    for col in df.columns:
        if col != TARGET_COLUMN and df[col].dtype == 'object' and col.lower() in ['text', 'message', 'email', 'sms']:
            text_column = col
            break
    
    if text_column is None and 'text' in df.columns:
        text_column = 'text'
    elif text_column is None:
        raise ValueError("Could not identify a suitable text column. Expected 'text', 'message', 'email', or 'sms'.")

    # Handle missing values in the text column by filling with empty strings
    df[text_column] = df[text_column].fillna('')

    # Encode target variable
    le = LabelEncoder()
    df[TARGET_COLUMN] = le.fit_transform(df[TARGET_COLUMN])
    
    # Define features (X) and target (y)
    X = df[text_column]
    y = df[TARGET_COLUMN]
    
    # Check for class imbalance (for logging purposes, RandomForest handles this via class_weight)
    class_counts = y.value_counts()
    minority_class_percentage = class_counts.min() / class_counts.sum() * 100
    print(f"Class distribution: {class_counts.to_dict()}")
    print(f"Minority class percentage: {minority_class_percentage:.2f}%")

    # 3. Split the dataset into train and test sets (80/20 split)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 4. Select and train a machine learning model
    # Using a Pipeline for TF-IDF Vectorization and RandomForestClassifier
    model_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=10000)), # Increased max_features
        ('classifier', RandomForestClassifier(random_state=42, class_weight='balanced'))
    ])

    # 5. Hyperparameter Tuning using RandomizedSearchCV (lightweight)
    param_dist = {
        'tfidf__max_features': [5000, 10000, 15000],
        'classifier__n_estimators': [50, 100, 150],
        'classifier__max_depth': [None, 10, 20],
        'classifier__min_samples_leaf': [1, 2]
    }

    print("Starting hyperparameter tuning...")
    random_search = RandomizedSearchCV(
        model_pipeline, 
        param_distributions=param_dist, 
        n_iter=5, # Keep n_iter small for quick execution
        cv=3, # Use 3-fold cross-validation
        scoring='f1_weighted', 
        random_state=42, 
        n_jobs=-1, # Use all available cores
        verbose=0
    )
    
    random_search.fit(X_train, y_train)
    best_model = random_search.best_estimator_
    
    print("Hyperparameter tuning complete. Best parameters:")
    print(random_search.best_params_)

    print("Starting final model training with best parameters...")
    # No need to refit if best_estimator_ is already fit during search with refit=True (default)
    # If we wanted to ensure the model is trained on the full training set (X_train, y_train) without CV splits
    # best_model.fit(X_train, y_train) # This step is implicitly done by refit=True in RandomizedSearchCV
    print("Model training complete (best model selected from search).")

    # Make predictions and evaluate
    y_pred = best_model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='weighted')

    # 6. Save the final trained model
    model_filename = 'best_model.pkl'
    with open(model_filename, 'wb') as file:
        pickle.dump(best_model, file)
    print(f"Model saved to {model_filename}")

    # Print metrics in JSON format
    results = {"status": "success", "metrics": {"accuracy": accuracy, "f1_score": f1}}
    print(json.dumps(results))

except Exception as e:
    logging.error(f"An error occurred during model training: {e}", exc_info=True)
    raise

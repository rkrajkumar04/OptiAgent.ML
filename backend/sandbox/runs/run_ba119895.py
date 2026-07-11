import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import ComplementNB
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
    
    # Check dataset size and class distribution
    total_samples = len(df)
    class_counts = y.value_counts()
    print(f"Total samples in dataset: {total_samples}")
    print(f"Class distribution: {class_counts.to_dict()}")
    
    if total_samples < 50:
        print("WARNING: Dataset is extremely small. Model performance and generalization will be severely limited.")

    # 3. Split the dataset into train and test sets (80/20 split)
    # With very small datasets, even stratified split can result in empty classes in a split
    # However, it's still the best practice, will use a fixed random_state.
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    print(f"Train set size: {len(X_train)}, Test set size: {len(X_test)}")

    # 4. Select and train a machine learning model
    # Using a Pipeline for TF-IDF Vectorization and Complement Naive Bayes Classifier
    # Adjusted TF-IDF parameters for a very small dataset
    model_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=1000, ngram_range=(1, 2))), # Reduced max_features, added ngrams
        ('classifier', ComplementNB(alpha=0.1)) # ComplementNB, small alpha for smoothing
    ])

    print("Starting model training...")
    model_pipeline.fit(X_train, y_train)
    print("Model training complete.")

    # Make predictions and evaluate
    y_pred = model_pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='weighted')

    # 6. Save the final trained model
    model_filename = 'best_model.pkl'
    with open(model_filename, 'wb') as file:
        pickle.dump(model_pipeline, file)
    print(f"Model saved to {model_filename}")

    # Print metrics in JSON format
    results = {"status": "success", "metrics": {"accuracy": accuracy, "f1_score": f1}}
    print(json.dumps(results))

except Exception as e:
    logging.error(f"An error occurred during model training: {e}", exc_info=True)
    raise

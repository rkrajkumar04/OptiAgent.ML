import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, f1_score
import pickle
import json
import warnings

warnings.filterwarnings('ignore')

# Dataset path and target column
DATASET_PATH = '/Users/rajkumarsharma/Desktop/ Ml_Experiment_Orchestrator /spam_dataset.csv'
TARGET_COLUMN = 'label'

try:
    # 1. Load the dataset
    df = pd.read_csv(DATASET_PATH)

    # Identify text column: Look for a common text column name or infer from dtypes
    text_column = None
    potential_text_columns = ['text', 'message', 'sms', 'email_content']
    for col in potential_text_columns:
        if col in df.columns:
            text_column = col
            break
    
    # If no common text column found, try to infer the largest string column
    if text_column is None:
        string_cols = df.select_dtypes(include='object').columns.tolist()
        string_cols = [col for col in string_cols if col != TARGET_COLUMN]
        if len(string_cols) > 0:
            # Assuming the text column would likely have the most unique values or be the longest strings
            text_column = max(string_cols, key=lambda x: df[x].nunique())
            print(f"Inferred text column: {text_column}")
        else:
            raise ValueError("No suitable text column found in the dataset.")

    if text_column == TARGET_COLUMN:
        raise ValueError("Identified text column is the same as target column. Please check dataset.")

    # Drop any potential ID columns or purely numerical columns if not relevant to text classification
    # For this first pass, we'll keep it simple and assume relevant columns are text_column and TARGET_COLUMN
    other_cols_to_drop = [col for col in df.columns if col not in [text_column, TARGET_COLUMN]]
    if other_cols_to_drop:
        df = df.drop(columns=other_cols_to_drop)

    # Ensure text column and target column exist
    if text_column not in df.columns:
        raise ValueError(f"Text column '{text_column}' not found in the dataset.")
    if TARGET_COLUMN not in df.columns:
        raise ValueError(f"Target column '{TARGET_COLUMN}' not found in the dataset.")

    # 2. Preprocessing
    # Handle missing values in text and target columns
    df.dropna(subset=[text_column, TARGET_COLUMN], inplace=True)
    df[text_column] = df[text_column].astype(str).fillna('') # Ensure text is string

    # Encode target variable
    label_encoder = LabelEncoder()
    df[TARGET_COLUMN] = label_encoder.fit_transform(df[TARGET_COLUMN])
    
    X = df[text_column]
    y = df[TARGET_COLUMN]

    # 3. Split the dataset into train and test sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 4. Model Selection and Pipeline
    # Create a pipeline with TfidfVectorizer and LogisticRegression
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(stop_words='english', max_features=5000)),
        ('clf', LogisticRegression(random_state=42, solver='liblinear', class_weight='balanced'))
    ])

    # 5. Hyperparameter Tuning (lightweight RandomizedSearchCV)
    param_distributions = {
        'tfidf__ngram_range': [(1, 1), (1, 2)],
        'tfidf__max_df': [0.75, 1.0],
        'clf__C': [0.1, 1.0, 10.0]
    }

    random_search = RandomizedSearchCV(
        pipeline, param_distributions=param_distributions, n_iter=3, cv=3, verbose=0, random_state=42, n_jobs=-1,
        scoring='f1_macro' # Using f1_macro for imbalanced classification tasks
    )

    random_search.fit(X_train, y_train)
    best_model = random_search.best_estimator_

    # 6. Evaluation
    y_pred = best_model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='macro') # Use 'macro' for multi-class or 'binary' for binary

    # 7. Save the final trained model
    with open('best_model.pkl', 'wb') as f:
        pickle.dump(best_model, f)

    # Print metrics in JSON format
    print(json.dumps({"status": "success", "metrics": {"accuracy": accuracy, "f1_score": f1}}))

except Exception as e:
    print(json.dumps({"status": "error", "message": str(e)}))
    raise

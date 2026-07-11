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

    # Ensure target column exists
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in the dataset.")

    # Separate target variable
    y = df[target_column]
    X = df.drop(columns=[target_column])

    # Encode target variable if it's categorical
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    # --- Refined Feature Type Identification ---
    text_column_name = None
    common_text_cols = ['text', 'message', 'sms', 'email_content', 'content']

    # 1. Prioritize common text column names
    for col in common_text_cols:
        if col in X.columns and X[col].dtype == 'object': # Check for object dtype as text is usually object
            text_column_name = col
            break

    # 2. If not found, use heuristic: select the object column with highest average string length and many unique values
    if text_column_name is None:
        object_cols = X.select_dtypes(include=['object', 'string']).columns.tolist()
        potential_text_cols = []
        for col in object_cols:
            # Heuristic: many unique values (more than 5% of dataset size) and average length > 5 chars
            if X[col].nunique() > 0.05 * len(X) and X[col].astype(str).apply(len).mean() > 5:
                potential_text_cols.append((col, X[col].astype(str).apply(len).mean()))
        
        if potential_text_cols:
            # Select the column with the highest average string length as the text column
            text_column_name = max(potential_text_cols, key=lambda item: item[1])[0]

    # Explicitly handle NaNs in the identified text column BEFORE splitting
    if text_column_name:
        X[text_column_name] = X[text_column_name].fillna('')

    # Re-identify numerical and categorical columns after text column handling
    numerical_cols = X.select_dtypes(include=np.number).columns.tolist()
    categorical_cols = X.select_dtypes(include=['object', 'string']).columns.tolist()

    # Remove text_column from categorical_cols if it was identified and present there
    if text_column_name and text_column_name in categorical_cols:
        categorical_cols.remove(text_column_name)

    # --- Preprocessing Pipelines for ColumnTransformer ---
    numerical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ])

    text_transformer = Pipeline(steps=[
        ('tfidf', TfidfVectorizer(max_features=20000, ngram_range=(1,2)))
    ])
    
    preprocessor_steps = []
    if numerical_cols: 
        preprocessor_steps.append(('num', numerical_transformer, numerical_cols))
    if categorical_cols: 
        preprocessor_steps.append(('cat', categorical_transformer, categorical_cols))
    if text_column_name: 
        preprocessor_steps.append(('text', text_transformer, text_column_name))
    
    preprocessor = ColumnTransformer(
        transformers=preprocessor_steps,
        remainder='drop' # Explicitly drop unhandled columns for safety
    )

    # --- Check for Class Imbalance ---
    class_counts = pd.Series(y_encoded).value_counts()
    imbalance_ratio = class_counts.min() / class_counts.max() if class_counts.max() > 0 else 1.0
    is_imbalanced = imbalance_ratio < 0.2

    # --- Model Definition ---
    model_params = {}
    if is_imbalanced:
        model_params['logisticregression__class_weight'] = 'balanced'

    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('logisticregression', LogisticRegression(solver='liblinear', random_state=42))
    ])

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded)

    # Hyperparameter tuning using RandomizedSearchCV
    param_distributions = {
        'logisticregression__C': np.logspace(-3, 0, 4),
        'logisticregression__penalty': ['l1', 'l2']
    }

    # Conditionally add TF-IDF parameters if a text column was identified
    if text_column_name:
        param_distributions['preprocessor__text__tfidf__max_features'] = [10000, 20000, None]
        param_distributions['preprocessor__text__tfidf__ngram_range'] = [(1, 1), (1, 2)]

    random_search = RandomizedSearchCV(
        pipeline,
        param_distributions,
        n_iter=5, 
        cv=3,     
        scoring='f1_weighted', 
        random_state=42,
        n_jobs=-1, 
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
    print(json.dumps({"status": "error", "message": str(e)}), file=sys.stderr)
    sys.exit(1)

from dataclasses import dataclass

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


@dataclass
class FeatureRoles:
    numeric: list[str]
    categorical: list[str]
    text: list[str]


def infer_feature_roles(df: pd.DataFrame, target_column: str) -> FeatureRoles:
    """Classifies feature columns into numeric, categorical, and text buckets."""
    numeric: list[str] = []
    categorical: list[str] = []
    text: list[str] = []

    for column in df.columns:
        if column == target_column:
            continue

        series = df[column]
        if pd.api.types.is_numeric_dtype(series):
            numeric.append(column)
            continue

        non_null = series.dropna().astype(str)
        if non_null.empty:
            categorical.append(column)
            continue

        avg_length = non_null.str.len().mean()
        unique_ratio = non_null.nunique() / max(len(non_null), 1)
        if avg_length >= 30 or unique_ratio > 0.7:
            text.append(column)
        else:
            categorical.append(column)

    return FeatureRoles(numeric=numeric, categorical=categorical, text=text)


def build_preprocessor(roles: FeatureRoles) -> ColumnTransformer:
    """Builds a sklearn transformer for mixed tabular/text datasets."""
    transformers = []

    if roles.numeric:
        numeric_pipeline = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ]
        )
        transformers.append(("numeric", numeric_pipeline, roles.numeric))

    if roles.categorical:
        categorical_pipeline = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OneHotEncoder(handle_unknown="ignore")),
            ]
        )
        transformers.append(("categorical", categorical_pipeline, roles.categorical))

    for column in roles.text:
        text_pipeline = Pipeline(
            steps=[
                ("tfidf", TfidfVectorizer(max_features=1000, stop_words="english")),
            ]
        )
        transformers.append((f"text_{column}", text_pipeline, column))

    if not transformers:
        raise ValueError("No usable feature columns were found after excluding the target column.")

    return ColumnTransformer(transformers=transformers, remainder="drop")

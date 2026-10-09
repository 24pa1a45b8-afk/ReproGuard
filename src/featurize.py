"""Featurize stage.

Split the prepared table into stratified train/test sets and standard-scale the features.
The scaler is fit on TRAIN ONLY (then applied to test) to avoid data leakage. Writes
data/features/train.csv and data/features/test.csv for the train/evaluate stages.
"""
import os

import pandas as pd
import yaml
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

IN = "data/prepared/wine.csv"
OUT_DIR = "data/features"
MAX_CATEGORIES = 50


def main():
    params = yaml.safe_load(open("params.yaml"))
    split = params["split"]
    featurize = params["featurize"]

    df = pd.read_csv(IN)
    X = df.drop(columns=["good"])
    y = df["good"]

    # Impute missing values and encode non-numeric columns if present
    numeric_cols = X.select_dtypes(include=["number"]).columns
    X_num = X[numeric_cols].fillna(X[numeric_cols].median())
    cat_cols = X.select_dtypes(exclude=["number"]).columns
    # One-hot encoding an ID/date/free-text column creates one feature per row; skip those
    high_card = [c for c in cat_cols if X[c].nunique() > MAX_CATEGORIES]
    if high_card:
        print(f"featurize: dropped high-cardinality columns {high_card}")
        cat_cols = cat_cols.drop(high_card)
    if len(cat_cols) > 0:
        X_cat = pd.get_dummies(X[cat_cols], drop_first=True)
        X = pd.concat([X_num, X_cat], axis=1)
    else:
        X = X_num

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=split["test_size"],
        random_state=split["seed"],
        stratify=y,            # keep the good/bad ratio identical in train & test
    )

    if featurize["scaler"] == "standard":
        scaler = StandardScaler()
        # fit on train, transform both -> no test information leaks into the scaler
        X_train = pd.DataFrame(scaler.fit_transform(X_train), columns=X.columns, index=X_train.index)
        X_test = pd.DataFrame(scaler.transform(X_test), columns=X.columns, index=X_test.index)

    os.makedirs(OUT_DIR, exist_ok=True)
    train = X_train.assign(good=y_train.values)
    test = X_test.assign(good=y_test.values)
    train.to_csv(os.path.join(OUT_DIR, "train.csv"), index=False)
    test.to_csv(os.path.join(OUT_DIR, "test.csv"), index=False)
    print(f"featurize: train={train.shape} test={test.shape} scaler={featurize['scaler']}")


if __name__ == "__main__":
    main()

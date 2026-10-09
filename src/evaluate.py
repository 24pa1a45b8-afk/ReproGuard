"""Evaluate stage.

Score the trained model on the held-out test set. Writes:
  - metrics.json : accuracy + ROC-AUC  (tracked in Git as a DVC metric, not the cache)
  - plots/roc.csv: ROC curve points    (we'll visualize these with `dvc plots` in Lesson 3)
"""
import json
import os
import pickle

import pandas as pd
from sklearn.metrics import accuracy_score, roc_auc_score, roc_curve

MODEL = "model.pkl"
IN = "data/features/test.csv"
METRICS = "metrics.json"
PLOTS_DIR = "plots"


def main():
    df = pd.read_csv(IN)
    X = df.drop(columns=["good"])
    y = df["good"]

    with open(MODEL, "rb") as f:
        model = pickle.load(f)

    if len(model.classes_) == 1:
        proba_val = 1.0 if model.classes_[0] == 1 else 0.0
        proba = pd.Series(proba_val, index=X.index).values
    else:
        proba = model.predict_proba(X)[:, 1]
        
    pred = (proba >= 0.5).astype(int)

    try:
        roc = float(roc_auc_score(y, proba))
        if pd.isna(roc):
            roc = 0.5
        fpr, tpr, _ = roc_curve(y, proba)
    except ValueError:
        roc = 0.5
        fpr, tpr = [0.0, 1.0], [0.0, 1.0]

    metrics = {
        "accuracy": float(accuracy_score(y, pred)),
        "roc_auc": roc,
    }
    with open(METRICS, "w") as f:
        json.dump(metrics, f, indent=2)

    os.makedirs(PLOTS_DIR, exist_ok=True)
    pd.DataFrame({"fpr": fpr, "tpr": tpr}).to_csv(os.path.join(PLOTS_DIR, "roc.csv"), index=False)

    print(f"evaluate: {metrics}")


if __name__ == "__main__":
    main()

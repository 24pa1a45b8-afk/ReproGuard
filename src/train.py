"""Train stage.

Fit a RandomForestClassifier on the scaled training set and pickle it to model.pkl.
random_state is pinned to split.seed so the model is deterministic -> stable hashes ->
DVC's skip/rerun logic stays trustworthy.
"""
import pickle

import pandas as pd
import yaml
from sklearn.ensemble import RandomForestClassifier

IN = "data/features/train.csv"
OUT = "model.pkl"


def main():
    params = yaml.safe_load(open("params.yaml"))
    train_p = params["train"]
    seed = params["split"]["seed"]

    df = pd.read_csv(IN)
    X = df.drop(columns=["good"])
    y = df["good"]

    model = RandomForestClassifier(
        n_estimators=train_p["n_estimators"],
        max_depth=train_p["max_depth"],
        random_state=seed,
    )
    model.fit(X, y)

    with open(OUT, "wb") as f:
        pickle.dump(model, f)
    print(f"train: RF n_estimators={train_p['n_estimators']} max_depth={train_p['max_depth']} -> {OUT}")


if __name__ == "__main__":
    main()

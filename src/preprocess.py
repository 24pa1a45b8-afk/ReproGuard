"""Preprocess stage.

Read the raw, semicolon-separated wine CSV and turn the integer `quality` score into a
binary `good` target (1 if quality >= threshold, else 0). Writes a clean, comma-separated
table to data/prepared/ for the featurize stage to consume.
"""
import os

import pandas as pd
import yaml

RAW = "data/raw/wine.csv"
OUT_DIR = "data/prepared"
OUT = os.path.join(OUT_DIR, "wine.csv")


def main():
    params = yaml.safe_load(open("params.yaml"))["preprocess"]
    threshold = params["quality_threshold"]

    # Detect delimiter and load CSV
    with open(RAW, "r", encoding="utf-8", errors="ignore") as f:
        first_line = f.readline()
    sep = ";" if first_line.count(";") > first_line.count(",") else ","

    df = pd.read_csv(RAW, sep=sep)
    # Strip whitespace/quotes from column names
    df.columns = [c.strip().strip('"').strip("'") for c in df.columns]

    if "quality" in df.columns:
        df["good"] = (df["quality"] >= threshold).astype(int)
        df = df.drop(columns=["quality"])
    else:
        # Fallback for custom uploaded datasets without 'quality' column
        target_candidates = [c for c in df.columns if any(k in c.lower() for k in ["target", "label", "value", "price", "class"])]
        target_col = target_candidates[0] if target_candidates else df.columns[-1]
        print(f"preprocess: Target column 'quality' not found. Adapting to '{target_col}'.")
        
        if pd.api.types.is_numeric_dtype(df[target_col]):
            median_val = df[target_col].median()
            df["good"] = (df[target_col] >= median_val).astype(int)
        else:
            codes, uniques = pd.factorize(df[target_col])
            df["good"] = (codes == 0).astype(int)
            
        df = df.drop(columns=[target_col])

    os.makedirs(OUT_DIR, exist_ok=True)
    df.to_csv(OUT, index=False)
    print(f"preprocess: wrote {OUT}  shape={df.shape}  good_rate={df['good'].mean():.3f}")


if __name__ == "__main__":
    main()

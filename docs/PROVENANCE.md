# Data Provenance — `data/raw/wine.csv`

A living record of where this project's data came from, how it moved into the repo, and what
has been done to it. Updated as the pipeline grows (preprocess → featurize → train → evaluate).

## Origin

- **Source:** UCI Machine Learning Repository — *Wine Quality* (red wine subset).
- **File:** `winequality-red.csv`
- **URL:** https://archive.ics.uci.edu/ml/machine-learning-databases/wine-quality/winequality-red.csv
- **Shape:** 1599 samples, `;`-separated, **11 physicochemical features** + 1 target.
  - Features: fixed acidity, volatile acidity, citric acid, residual sugar, chlorides,
    free sulfur dioxide, total sulfur dioxide, density, pH, sulphates, alcohol.
  - Target: `quality` (integer score, ~0–10).
- **Note:** this is the *red-only* dataset. UCI dataset #186 also ships a combined
  red+white file (comma-separated, with a `color` column) — deliberately **not** used here so
  the project stays a clean red-wine regression/classification task.

## Movement

- **Method:** `dvc import-url` (tracks the upstream source, not just the bytes).
  ```bash
  dvc import-url \
    https://archive.ics.uci.edu/ml/machine-learning-databases/wine-quality/winequality-red.csv \
    data/raw/wine.csv
  ```
- **What is tracked in Git:** the pointer `data/raw/wine.csv.dvc` (carries a `deps` block with
  the source URL + checksum, and an `outs` block with the data's md5) and
  `data/raw/.gitignore`. The CSV itself lives in the DVC cache and is **not** committed to Git.
- **Frozen import:** the `.dvc` file has `frozen: true`, so `dvc repro` will not silently
  re-fetch. To intentionally re-pull upstream changes: `dvc update data/raw/wine.csv.dvc`.

## Manipulation

- **Current:** none. `data/raw/wine.csv` is the raw file exactly as imported.
- **Planned (Lesson 2+):** preprocess → `data/prepared/`, featurize → `data/features/`,
  train → `model.pkl`, evaluate → `metrics.json` + `plots/`. Each step will be appended here
  with its script, inputs, and outputs once the pipeline stages exist.

## Change log

- **2026-06-30** — Initial import via `dvc import-url` (red-only `;`-separated dataset).
  Briefly imported the combined red+white file first, then re-imported the red-only file to
  match the project's red-wine framing and `sep=";"` convention.

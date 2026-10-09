# Wine-Quality MLOps — Data Version Control, End to End

**A reproducible machine-learning pipeline that versions its data and models the way Git versions code — from a provenance-tracked import to a cloud remote and a CI job that rebuilds the model from scratch.**

[![CI](https://github.com/HelloJahid/dvc-ml-pipeline/actions/workflows/dvc.yml/badge.svg)](https://github.com/HelloJahid/dvc-ml-pipeline/actions/workflows/dvc.yml)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![DVC](https://img.shields.io/badge/DVC-3.67.1-13ADC7?logo=dvc&logoColor=white)](https://dvc.org/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## The problem this solves

You check out last month's commit to reproduce a result. The code is byte-for-byte identical — but the accuracy is different. Nothing in Git changed, so what moved? **The data moved.** Git was only ever tracking a *pointer* to it.

This repository is a hands-on demonstration of closing that gap with **DVC (Data Version Control)**: versioning data and models, wiring them into a reproducible pipeline, running tracked experiments, pushing to cloud storage, and reproducing the whole thing in CI. The ML task — predicting red-wine quality — is deliberately simple so the focus stays on the **MLOps mechanics**.

## What this demonstrates

- 📦 **Provenance-tracked data ingestion** — `dvc import-url` with a frozen pointer (source URL + content hash), so the dataset can't silently change.
- 🔁 **A reproducible multi-stage pipeline** — a 4-stage DAG (`preprocess → featurize → train → evaluate`) that `dvc repro` rebuilds *incrementally*, re-running only what changed.
- 📊 **Versioned metrics & plots** — `dvc metrics diff` and `dvc plots diff` compare model versions straight from Git history.
- 🧪 **Experiment management** — hyperparameter grids via `dvc exp run --queue`, compared and promoted without cluttering branch history.
- 🗄️ **Content-addressable storage** — understanding the md5-keyed cache: dedup, integrity, immutability.
- ☁️ **Local & AWS S3 remotes** — push/pull data to the cloud; the credential chain and least-privilege access.
- ⏪ **Data time-travel** — reconstruct any historical data/model version with `git checkout` + `dvc checkout`.
- ⚙️ **CI that reproduces the model** — a GitHub Actions workflow that pulls data, runs the pipeline, and reports metrics on every push.

## Pipeline at a glance

```
 params.yaml ──(each stage reads only its own keys)───────────────┐
                                                                   ▼
 data/raw/wine.csv ──▶ preprocess ──▶ data/prepared ──▶ featurize ──▶ data/features
   (frozen import)     binarize        (cached)          split+scale     (cached)
                                                                            │
                                                                            ▼
        metrics.json + plots/roc.csv ◀── evaluate ◀── model.pkl ◀── train
              (Git)          (plot)                    (cached)      RandomForest
```

Shared file paths are the edges that create the dependency order — change one stage's input and staleness propagates *downstream only*.

## Results

A 100-tree random forest at depth 8, on the held-out test set:

| Metric | Value |
|---|---|
| Accuracy | **0.7844** |
| ROC-AUC | **0.8748** |

A 2×3 hyperparameter sweep surfaced a clean finding: **`max_depth` drives the score; `n_estimators` barely matters.** The naive top-AUC run (300 trees) beat the 100-tree model by ~0.0004 AUC at 3× the cost — so the Pareto-smart 100-tree/depth-8 model was promoted as the baseline.

## Tech stack

`Python 3.12` · `DVC 3.67.1` · `scikit-learn` · `pandas` · `PyYAML` · `matplotlib` · GitHub Actions · developed in GitHub Codespaces.

## Quickstart — reproduce it yourself

```bash
git clone https://github.com/HelloJahid/dvc-ml-pipeline && cd dvc-ml-pipeline

python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

dvc pull          # fetch the exact data + model the code expects
dvc repro         # rebuild the pipeline (up to date if hashes match)
dvc metrics show  # accuracy 0.7844, roc_auc 0.8748
```

No remote access? `dvc update data/raw/wine.csv.dvc` re-fetches the public raw data and `dvc repro` regenerates everything — the pipeline is deterministic.

## Project structure

```
dvc-ml-pipeline/
├── src/                      # pipeline stages
│   ├── preprocess.py         #   raw → binarized "good" target
│   ├── featurize.py          #   stratified split + standard-scale
│   ├── train.py              #   fit RandomForest → model.pkl
│   └── evaluate.py           #   metrics.json + plots/roc.csv
├── params.yaml               # ✅ hyperparameters / split config
├── dvc.yaml                  # ✅ pipeline definition (the DAG)
├── dvc.lock                  # ✅ resolved hashes → drives skip/rerun
├── data/ · model.pkl · plots/  # 🔒 data & artefacts (DVC-cached, gitignored)
├── .github/workflows/dvc.yml # ✅ CI: pull → repro → metrics
└── docs/                     # DVC.md (concepts) · PROVENANCE.md (data lineage)
```

✅ tracked in Git (code + pointers) · 🔒 stored in the DVC cache/remote (data never enters Git).

## Documentation

| Document | What's inside |
|---|---|
| **[docs/DVC.md](docs/DVC.md)** | A concept reference for Data Version Control — provenance, cache, pipelines, remotes, experiments. |
| **[docs/PROVENANCE.md](docs/PROVENANCE.md)** | Data lineage for `data/raw/wine.csv` — origin, ingestion method, change log. |

## License

Released under the [MIT License](LICENSE). © 2026 Md Jahid Hasan.

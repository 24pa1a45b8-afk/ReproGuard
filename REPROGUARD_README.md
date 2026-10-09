# ReproGuard: Reproducibility Auditing Interface for ML Pipelines

> *"Trust Every Experiment. Reproduce Every Result."*

ReproGuard is an experiment reproducibility auditing and verification platform tailored for scientific and production machine-learning pipelines. It provides researchers, ML engineers, and hackathon review juries with deep introspection into pipeline provenance, dataset integrity, parameter variance, environment pinning, and metric drift.

This implementation is adapted to the **HelloJahid/dvc-ml-pipeline** red-wine quality classification project, introspecting real `dvc.yaml`, `params.yaml`, `dvc.lock`, `metrics.json`, and `requirements.txt` artifacts.

---

## 🏛️ System Architecture

ReproGuard consists of two integrated components:

1. **Frontend (React + Vite + TypeScript + Tailwind CSS v4 + Recharts + Lucide Icons)**:
   - Modern, scientific SaaS dashboard aesthetic (Ivory background `#F8F8F4`, Forest Green `#245C49`, Teal Accent `#38A58A`, Ink Text `#17221F`).
   - Clean, subtle borders and typography without gradients or excessive decorative noise.
   - Comprehensive multi-view workspace: Overview, Pipeline Explorer, Reproducibility Audit, Experiment Comparison, Provenance Explorer, Audit Reports, and Settings.

2. **Backend (FastAPI Engine)**:
   - Safe introspection service reading repository metadata, hashes, parameters, and metrics.
   - Provides REST endpoints for live pipeline graph introspection, audit check execution, provenance DAG construction, and reproduction execution.

---

## 🚀 Quickstart & Installation

### 1. Prerequisites
- **Python 3.10+** (with `fastapi`, `uvicorn`, `pyyaml` installed)
- **Node.js 18+** & **npm**

### 2. Running the Backend API
From the repository root (`dvc-ml-pipeline-main`):
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
API docs available at: `http://127.0.0.1:8000/docs`

### 3. Running the Frontend Dashboard
From the `frontend/` directory:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## 🔍 Feature Breakdown: Real vs. Demo Data

In accordance with scientific integrity guidelines, ReproGuard clearly distinguishes between verified data read from the repository versus demonstration/simulation values:

| Feature / View | Status | Data Source & Mechanism |
| :--- | :--- | :--- |
| **Pipeline Stages** | **Real / Live** | Parsed directly from `dvc.yaml` (`preprocess`, `featurize`, `train`, `evaluate`). |
| **Stage Dependencies & Outputs** | **Real / Live** | Cross-referenced against `dvc.lock` with real file sizes and MD5 hashes (`2daeecee...`, `9f233195...`, `17101140...`). |
| **Stage Parameters** | **Real / Live** | Read from `params.yaml` (`quality_threshold: 6`, `split.seed: 42`, `train.n_estimators: 100`, `train.max_depth: 8`). |
| **Baseline Evaluation Metrics** | **Real / Live** | Read from `metrics.json` (Accuracy: `0.784375`, ROC-AUC: `0.87479885`). |
| **Dataset Fingerprint Check** | **Real / Live** | Verifies `data/raw/wine.csv.dvc` against `dvc.lock` MD5 (`2daeecee174368f8a33b82c8cccae3a5`). |
| **Software Environment Check** | **Real / Live** | Inspects `requirements.txt` (122 pinned packages with exact `==` versions). |
| **Reproducibility Audit Engine** | **Real / Live** | Evaluates real categories (Dataset Integrity, Pipeline Provenance, Configuration, Environment, Results Tolerance) and returns structured findings. |
| **Provenance Lineage** | **Real / Live** | Constructs verified DAG chain from raw CSV to ROC plots with completeness scoring. |
| **Download Audit Report (JSON)** | **Real / Live** | Functional JSON export containing full timestamped audit evidence and checklist. |
| **Experiment Comparison Table** | **Hybrid** | Baseline (`exp-baseline`) reflects real repo state; comparison runs (`exp-rf-depth12`, `exp-rf-noseed`) illustrate parameter drift & seed omissions. |
| **DVC Reproduction Action** | **Verified Mock / Safe Execution** | Validates stages and locks without running arbitrary untrusted shell code from the browser. |

---

## 🛡️ Reproducibility Audit Checklist

ReproGuard evaluates experiments across 5 rigorous criteria:

1. **Category A: Dataset Integrity**
   - Raw dataset availability and fingerprint verification (`MD5` match against `dvc.lock` and `.dvc` tracking files).
2. **Category B: Pipeline Provenance**
   - Verification that stage scripts (`src/preprocess.py`, `src/featurize.py`, `src/train.py`, `src/evaluate.py`) are present, hashed, and match `dvc.yaml`.
3. **Category C: Configuration & Determinism**
   - Audit for explicit random seeds (`split.seed: 42`) and model hyperparameters (`n_estimators: 100`, `max_depth: 8`).
4. **Category D: Environment Specification**
   - Audit of Python runtime and `requirements.txt` version pinning to prevent dependency drift.
5. **Category E: Results & Metric Tolerance**
   - Evaluation of recorded metrics against documented baselines within an epsilon tolerance ($\pm 0.001$).

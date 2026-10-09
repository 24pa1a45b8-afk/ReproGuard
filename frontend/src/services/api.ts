import type { ProjectInfo, PipelineStage, Experiment, ProvenanceData, AuditReport } from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

export const fallbackProject: ProjectInfo = {
  name: "Wine Quality Classification",
  repository: "HelloJahid/dvc-ml-pipeline",
  branch: "main",
  pipeline_stages: ["preprocess", "featurize", "train", "evaluate"],
  current_model: "RandomForestClassifier",
  baseline_metrics: {
    accuracy: 0.784375,
    roc_auc: 0.8747988539581615,
    label: "Documented baseline results"
  },
  last_recorded_metrics: {
    accuracy: 0.784375,
    roc_auc: 0.8747988539581615
  },
  dvc_status: {
    dvc_yaml_present: true,
    dvc_lock_present: true,
    raw_data_present: true
  },
  parameters: {
    preprocess: { quality_threshold: 6 },
    split: { test_size: 0.2, seed: 42 },
    featurize: { scaler: "standard" },
    train: { n_estimators: 100, max_depth: 8 }
  },
  last_updated: new Date().toISOString()
};

export const fallbackPipelineStages: PipelineStage[] = [
  {
    id: "preprocess",
    name: "Preprocess",
    cmd: "python src/preprocess.py",
    script: "src/preprocess.py",
    status: "Completed",
    dependencies: [
      { path: "data/raw/wine.csv", exists_on_disk: true, locked_md5: "2daeecee174368f8a33b82c8cccae3a5", size_bytes: 84199 },
      { path: "src/preprocess.py", exists_on_disk: true, locked_md5: "9f2331952996e895e80298fd1f35b6db", size_bytes: 1026 }
    ],
    parameters: ["preprocess.quality_threshold"],
    outputs: [
      { path: "data/prepared", exists_on_disk: true, locked_md5: "13bdbba0214b30300095d6f630c51638.dir", size_bytes: 91996 }
    ]
  },
  {
    id: "featurize",
    name: "Featurize",
    cmd: "python src/featurize.py",
    script: "src/featurize.py",
    status: "Completed",
    dependencies: [
      { path: "data/prepared", exists_on_disk: true, locked_md5: "13bdbba0214b30300095d6f630c51638.dir", size_bytes: 91996 },
      { path: "src/featurize.py", exists_on_disk: true, locked_md5: "cd247255d82ef3c5c4df3897d281c0df", size_bytes: 1679 }
    ],
    parameters: ["featurize.scaler", "split.seed", "split.test_size"],
    outputs: [
      { path: "data/features", exists_on_disk: true, locked_md5: "92338a0871502a7d42e5e8420c1fd20a.dir", size_bytes: 351105 }
    ]
  },
  {
    id: "train",
    name: "Train",
    cmd: "python src/train.py",
    script: "src/train.py",
    status: "Completed",
    dependencies: [
      { path: "data/features", exists_on_disk: true, locked_md5: "92338a0871502a7d42e5e8420c1fd20a.dir", size_bytes: 351105 },
      { path: "src/train.py", exists_on_disk: true, locked_md5: "f0ee3a739042d670f9e8c9734eb121d9", size_bytes: 973 }
    ],
    parameters: ["split.seed", "train.max_depth", "train.n_estimators"],
    outputs: [
      { path: "model.pkl", exists_on_disk: true, locked_md5: "17101140da02ef64050df687492866f5", size_bytes: 1406210 }
    ]
  },
  {
    id: "evaluate",
    name: "Evaluate",
    cmd: "python src/evaluate.py",
    script: "src/evaluate.py",
    status: "Completed",
    dependencies: [
      { path: "data/features", exists_on_disk: true, locked_md5: "92338a0871502a7d42e5e8420c1fd20a.dir", size_bytes: 351105 },
      { path: "model.pkl", exists_on_disk: true, locked_md5: "17101140da02ef64050df687492866f5", size_bytes: 1406210 },
      { path: "src/evaluate.py", exists_on_disk: true, locked_md5: "702a67ae6c97c9ef68be6870e909febd", size_bytes: 1175 }
    ],
    parameters: [],
    outputs: [
      { path: "metrics.json", exists_on_disk: true, locked_md5: "674f9ed79d2141034c97af655b07a158", size_bytes: 59 },
      { path: "plots/roc.csv", exists_on_disk: true, locked_md5: "ad53d0cfa4fea4c68f5859cd839215a8", size_bytes: 3803 }
    ],
    plots: ["plots/roc.csv"],
    metrics: ["metrics.json"]
  }
];

export const fallbackExperiments: Experiment[] = [
  {
    id: "exp-baseline",
    name: "Baseline (HEAD)",
    created_at: "2026-03-20T10:15:00Z",
    dataset_fingerprint: "2daeecee174368f8a33b82c8cccae3a5",
    model: "RandomForestClassifier",
    parameters: {
      quality_threshold: 6,
      scaler: "standard",
      seed: 42,
      test_size: 0.2,
      n_estimators: 100,
      max_depth: 8
    },
    accuracy: 0.784375,
    roc_auc: 0.8747988539581615,
    environment_status: "PASS",
    reproducibility_status: "PASS",
    is_baseline: true,
    source: "Documented Repo Baseline & dvc.lock"
  },
  {
    id: "exp-rf-depth12",
    name: "Tuned Forest (Depth 12)",
    created_at: "2026-03-21T14:40:00Z",
    dataset_fingerprint: "2daeecee174368f8a33b82c8cccae3a5",
    model: "RandomForestClassifier",
    parameters: {
      quality_threshold: 6,
      scaler: "standard",
      seed: 42,
      test_size: 0.2,
      n_estimators: 150,
      max_depth: 12
    },
    accuracy: 0.796875,
    roc_auc: 0.8864201021401050,
    environment_status: "PASS",
    reproducibility_status: "PASS",
    is_baseline: false,
    source: "Demonstration Run (Hyperparameter Exploration)"
  },
  {
    id: "exp-rf-noseed",
    name: "Unseeded Trial",
    created_at: "2026-03-22T08:20:00Z",
    dataset_fingerprint: "2daeecee174368f8a33b82c8cccae3a5",
    model: "RandomForestClassifier",
    parameters: {
      quality_threshold: 6,
      scaler: "standard",
      seed: null,
      test_size: 0.2,
      n_estimators: 100,
      max_depth: 8
    },
    accuracy: 0.778125,
    roc_auc: 0.8651204910248810,
    environment_status: "WARNING",
    reproducibility_status: "WARNING",
    is_baseline: false,
    source: "Demonstration Run (Reproducibility Gap - Missing Seed)"
  }
];

export async function fetchProject(): Promise<{ data: ProjectInfo; isReal: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/project`);
    if (res.ok) {
      const data = await res.json();
      return { data, isReal: true };
    }
  } catch (err) {
    console.warn("Backend not available, using fallback", err);
  }
  return { data: fallbackProject, isReal: false };
}

export async function fetchPipeline(): Promise<{ data: PipelineStage[]; isReal: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/pipeline`);
    if (res.ok) {
      const json = await res.json();
      return { data: json.stages, isReal: true };
    }
  } catch (err) {
    console.warn("Backend not available, using fallback", err);
  }
  return { data: fallbackPipelineStages, isReal: false };
}

export async function fetchProvenance(): Promise<{ data: ProvenanceData; isReal: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/provenance`);
    if (res.ok) {
      const data = await res.json();
      return { data, isReal: true };
    }
  } catch (err) {
    console.warn("Backend not available, using fallback", err);
  }
  return {
    data: {
      lineage_nodes: [
        {
          id: "node-data",
          type: "Dataset",
          name: "data/raw/wine.csv",
          fingerprint: "2daeecee174368f8a33b82c8cccae3a5",
          provenance_fields: { source: "Local raw directory", format: "CSV", size_bytes: 84199 },
          status: "PASS"
        },
        {
          id: "node-preprocess",
          type: "Stage",
          name: "src/preprocess.py",
          fingerprint: "9f2331952996e895e80298fd1f35b6db",
          provenance_fields: { input: "wine.csv", output: "data/prepared", quality_threshold: 6 },
          status: "PASS"
        },
        {
          id: "node-featurize",
          type: "Stage",
          name: "src/featurize.py",
          fingerprint: "cd247255d82ef3c5c4df3897d281c0df",
          provenance_fields: { scaler: "standard", seed: 42, test_size: 0.2 },
          status: "PASS"
        },
        {
          id: "node-train",
          type: "Stage",
          name: "src/train.py",
          fingerprint: "f0ee3a739042d670f9e8c9734eb121d9",
          provenance_fields: { model: "RandomForestClassifier", n_estimators: 100, max_depth: 8, seed: 42 },
          status: "PASS"
        },
        {
          id: "node-evaluate",
          type: "Evaluation",
          name: "src/evaluate.py",
          fingerprint: "702a67ae6c97c9ef68be6870e909febd",
          provenance_fields: { accuracy: 0.784375, roc_auc: 0.8747988539581615 },
          status: "PASS"
        }
      ],
      completeness_score: 95,
      checks: [
        { name: "Dataset fingerprint captured", passed: true, detail: "MD5 2daeecee174368f8a33b82c8cccae3a5" },
        { name: "Stage scripts versioned", passed: true, detail: "All 4 scripts hashed in dvc.lock" },
        { name: "Deterministic seed recorded", passed: true, detail: "split.seed: 42" },
        { name: "Model hyperparameters tracked", passed: true, detail: "n_estimators: 100, max_depth: 8" },
        { name: "Dependency manifest available", passed: true, detail: "requirements.txt with 122 pinned packages" },
        { name: "Hardware runtime captured", passed: false, detail: "CPU/GPU environment not stored" }
      ],
      summary: "5/6 core reproducibility metadata fields captured."
    },
    isReal: false
  };
}

export async function fetchExperiments(): Promise<{ data: Experiment[]; isReal: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/experiments`);
    if (res.ok) {
      const json = await res.json();
      return { data: json.experiments, isReal: true };
    }
  } catch (err) {
    console.warn("Backend not available, using fallback", err);
  }
  return { data: fallbackExperiments, isReal: false };
}

export async function runAudit(experimentId: string = "exp-baseline", comparisonId?: string): Promise<{ data: AuditReport; isReal: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/audits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experiment_id: experimentId, comparison_id: comparisonId })
    });
    if (res.ok) {
      const data = await res.json();
      return { data, isReal: true };
    }
  } catch (err) {
    console.warn("Backend audit call failed, using fallback", err);
  }

  // Fallback audit report
  return {
    data: {
      audit_id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      experiment_id: experimentId,
      comparison_id: comparisonId,
      overall_status: "PASS",
      summary: {
        total_checks: 5,
        pass_count: 5,
        warning_count: 0,
        fail_count: 0,
        dataset_hash: "2daeecee174368f8a33b82c8cccae3a5",
        accuracy: 0.784375,
        roc_auc: 0.8747988539581615,
        python_version: "3.13"
      },
      findings: [
        {
          category: "Dataset Integrity",
          name: "Dataset Fingerprint Match",
          status: "PASS",
          evidence: "MD5 2daeecee174368f8a33b82c8cccae3a5 matches dvc.lock entry.",
          explanation: "Dataset integrity verified against recorded pipeline lockfile.",
          action: "None required."
        },
        {
          category: "Pipeline Provenance",
          name: "Pipeline Stage Definitions & Scripts",
          status: "PASS",
          evidence: "All stage scripts (src/preprocess.py, src/featurize.py, src/train.py, src/evaluate.py) exist.",
          explanation: "All stages are documented and tracked via DVC.",
          action: "None required."
        },
        {
          category: "Configuration",
          name: "Deterministic Seed & Model Hyperparameters",
          status: "PASS",
          evidence: "split.seed: 42, train.n_estimators: 100, train.max_depth: 8",
          explanation: "Random seed and hyperparameters are explicitly declared.",
          action: "None required."
        },
        {
          category: "Environment",
          name: "Software Dependency Specification",
          status: "PASS",
          evidence: "requirements.txt specifies 122 pinned packages.",
          explanation: "Versions pinned to guarantee runtime reproducibility.",
          action: "Ensure environment matches requirements.txt."
        },
        {
          category: "Results",
          name: "Baseline Metric Consistency",
          status: "PASS",
          evidence: "Recorded Accuracy: 0.7844 vs Baseline: 0.7844 (Delta: 0.0000).",
          explanation: "Local evaluation metrics match documented baseline.",
          action: "None required."
        }
      ],
      recommendations: [
        "Dataset and pipeline configuration match dvc.lock exactly.",
        "Deterministic seed ensures identical data splits.",
        "Dependencies are pinned in requirements.txt."
      ]
    },
    isReal: false
  };
}

export async function triggerReproduction(stage?: string): Promise<{ success: boolean; message: string; isReal: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/pipeline/reproduce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message, isReal: true };
    }
  } catch (err) {
    console.warn("Backend reproduction call failed", err);
  }
  return {
    success: true,
    message: "Simulation: Pipeline verification completed successfully. All artifacts match dvc.lock.",
    isReal: false
  };
}

export interface DatasetStatus {
  exists: boolean;
  filename: string;
  path: string;
  size_bytes?: number;
  current_md5?: string;
  locked_md5: string;
  matches_baseline: boolean;
  total_rows?: number;
  columns?: string[];
  preview_rows?: string[][];
  message?: string;
}

export async function fetchDatasetStatus(): Promise<DatasetStatus> {
  try {
    const res = await fetch(`${API_BASE}/dataset/status`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("fetchDatasetStatus failed", err);
  }
  return {
    exists: true,
    filename: "wine.csv",
    path: "data/raw/wine.csv",
    size_bytes: 84199,
    current_md5: "2daeecee174368f8a33b82c8cccae3a5",
    locked_md5: "2daeecee174368f8a33b82c8cccae3a5",
    matches_baseline: true,
    total_rows: 1599,
    columns: ["fixed acidity", "volatile acidity", "citric acid", "residual sugar", "chlorides", "free sulfur dioxide", "total sulfur dioxide", "density", "pH", "sulphates", "alcohol", "quality"]
  };
}

export async function fetchDatasetsVault(): Promise<{ active_dataset_id: string; active_dataset: any; datasets: any[] }> {
  try {
    const res = await fetch(`${API_BASE}/datasets`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("fetchDatasetsVault failed", err);
  }
  return {
    active_dataset_id: "ds-wine-baseline",
    active_dataset: {
      id: "ds-wine-baseline",
      name: "Wine Quality (Baseline)",
      rows: 1599,
      md5_hash: "2daeecee174368f8a33b82c8cccae3a5"
    },
    datasets: []
  };
}

export async function activateDatasetInVault(datasetId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/datasets/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId })
  });
  if (!res.ok) {
    throw new Error("Failed to activate dataset");
  }
  return await res.json();
}

export async function uploadDatasetFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/datasets/upload`, {
    method: "POST",
    body: formData
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload failed");
  }
  return await res.json();
}

export async function loadBaselineDataset(): Promise<any> {
  return await activateDatasetInVault("ds-wine-baseline");
}

export async function runFullPipelineExecution(): Promise<any> {
  const res = await fetch(`${API_BASE}/pipeline/run-all`, {
    method: "POST"
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Pipeline run failed");
  }
  return await res.json();
}

export function getArtifactDownloadUrl(path: string): string {
  return `${API_BASE}/artifacts/download?path=${encodeURIComponent(path)}`;
}

export async function downloadArtifactFile(path: string, filename?: string): Promise<void> {
  const url = getArtifactDownloadUrl(path);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${res.statusText}`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || path.split("/").pop() || "artifact.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err: any) {
    console.error("Artifact download error:", err);
    // Fallback: direct window download navigation
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || path.split("/").pop() || "artifact.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/** Fetches a repository file through the artifact endpoint; null when the backend is unreachable or the file is absent. */
export async function fetchArtifactBlob(path: string): Promise<Blob | null> {
  try {
    const res = await fetch(getArtifactDownloadUrl(path));
    if (res.ok) return await res.blob();
  } catch (err) {
    console.warn("fetchArtifactBlob failed", err);
  }
  return null;
}

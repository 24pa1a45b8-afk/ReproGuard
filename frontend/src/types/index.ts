export type AuditStatus = 'PASS' | 'WARNING' | 'FAIL' | 'NOT CHECKED';

export interface DatasetRecord {
  id: string;
  name: string;
  filename: string;
  path: string;
  size_bytes: number;
  md5_hash: string;
  rows: number;
  columns: string[];
  target_column?: string;
  is_baseline: boolean;
  uploaded_at: string;
  last_run_metrics?: {
    accuracy: number;
    roc_auc: number;
    timestamp: string;
  } | null;
}

export interface Finding {
  category: string;
  name: string;
  status: AuditStatus;
  evidence: string;
  explanation: string;
  action?: string;
}

export interface AuditReport {
  audit_id: string;
  timestamp: string;
  experiment_id: string;
  comparison_id?: string;
  active_dataset?: DatasetRecord;
  overall_status: AuditStatus;
  summary: {
    dataset_name?: string;
    total_checks: number;
    pass_count: number;
    warning_count: number;
    fail_count: number;
    dataset_hash: string;
    accuracy: number;
    roc_auc: number;
    python_version: string;
  };
  findings: Finding[];
  recommendations: string[];
}

export interface DependencyInfo {
  path: string;
  exists_on_disk: boolean;
  locked_md5?: string | null;
  size_bytes?: number | null;
}

export interface ArtifactFile {
  path: string;
  name: string;
  is_csv: boolean;
  size_bytes?: number | null;
}

export interface OutputInfo {
  path: string;
  exists_on_disk: boolean;
  is_dir?: boolean;
  locked_md5?: string | null;
  size_bytes?: number | null;
  files?: ArtifactFile[];
}

export interface PipelineStage {
  id: string;
  name: string;
  cmd: string;
  script: string | null;
  status: 'Completed' | 'Needs verification' | 'Failed' | 'Not run';
  dependencies: DependencyInfo[];
  parameters: string[];
  outputs: OutputInfo[];
  plots?: string[];
  metrics?: string[];
}

export interface ProjectInfo {
  name: string;
  repository: string;
  branch: string;
  pipeline_stages: string[];
  current_model: string;
  baseline_metrics: {
    accuracy: number;
    roc_auc: number;
    label: string;
  };
  last_recorded_metrics: {
    accuracy?: number;
    roc_auc?: number;
  };
  dvc_status: {
    dvc_yaml_present: boolean;
    dvc_lock_present: boolean;
    raw_data_present: boolean;
  };
  parameters: Record<string, any>;
  dataset_info?: {
    exists: boolean;
    name?: string;
    filename?: string;
    target_column?: string;
    current_hash: string | null;
    locked_hash: string;
    matches_baseline: boolean;
    row_count: number;
    size_bytes: number;
  };
  last_updated: string;
}

export interface Experiment {
  id: string;
  name: string;
  created_at: string;
  dataset_name?: string;
  dataset_fingerprint: string;
  model: string;
  parameters: {
    quality_threshold?: number;
    scaler?: string;
    seed?: number | null;
    test_size?: number;
    n_estimators?: number;
    max_depth?: number;
    [key: string]: any;
  };
  accuracy: number;
  roc_auc: number;
  environment_status: AuditStatus;
  reproducibility_status: AuditStatus;
  is_baseline: boolean;
  source: string;
}

export interface ProvenanceNode {
  id: string;
  type: string;
  name: string;
  fingerprint: string;
  provenance_fields: Record<string, any>;
  status: AuditStatus;
}

export interface ProvenanceCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ProvenanceData {
  lineage_nodes: ProvenanceNode[];
  completeness_score: number;
  checks: ProvenanceCheck[];
  summary: string;
}

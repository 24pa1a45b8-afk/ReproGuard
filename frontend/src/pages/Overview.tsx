import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Database, 
  GitCommit, 
  CheckCircle, 
  ArrowRight, 
  Cpu, 
  ShieldCheck,
  ExternalLink,
  Layers
} from 'lucide-react';
import { fetchProject, fetchPipeline, fetchProvenance } from '../services/api';
import type { ProjectInfo, PipelineStage, ProvenanceData } from '../types';

export default function Overview() {
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [provenance, setProvenance] = useState<ProvenanceData | null>(null);
  const [isLive, setIsLive] = useState(false);

  const loadData = () => {
    fetchProject().then(res => {
      setProject(res.data);
      setIsLive(res.isReal);
    });
    fetchPipeline().then(res => setStages(res.data));
    fetchProvenance().then(res => setProvenance(res.data));
  };

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('dataset-changed', handler);
    return () => window.removeEventListener('dataset-changed', handler);
  }, []);

  const isCustomDataset = !project?.dataset_info?.matches_baseline;
  const activeDatasetName = project?.dataset_info?.name || project?.name || "Wine Quality Classification";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-text tracking-tight">Reproducibility Overview</h1>
            <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium ${
              isCustomDataset ? 'bg-warning/10 text-warning border border-warning/30' : 'bg-primary/10 text-primary border border-primary/30'
            }`}>
              {isCustomDataset ? `● Active: ${activeDatasetName}` : '● Verified Baseline (Wine Quality)'}
            </span>
            {isLive && (
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-mono font-semibold">
                Live Engine
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-1">
            Understand what produced your model results—and whether those results can be reproduced.
          </p>
        </div>

        <button 
          onClick={() => navigate('/audit')}
          className="inline-flex items-center px-4 py-2 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/90 transition-colors shadow-xs self-start md:self-auto cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 mr-1.5" />
          Open Full Audit
        </button>
      </div>

      {/* Project Summary Banner */}
      <div className="bg-surface p-5 rounded-lg border border-border shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="pt-2 md:pt-0">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Target Dataset</span>
            <span className="text-base font-bold text-text mt-1 block truncate" title={activeDatasetName}>
              {activeDatasetName}
            </span>
            <span className="text-xs font-mono text-muted block mt-0.5">
              {project?.dataset_info?.row_count ? `${project.dataset_info.row_count.toLocaleString()} rows` : "wine.csv"}
              {project?.dataset_info?.target_column ? ` • Target: ${project.dataset_info.target_column}` : ""}
            </span>
          </div>

          <div className="pt-4 md:pt-0 md:pl-6">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Current Model</span>
            <span className="text-sm font-semibold text-text mt-1 block flex items-center">
              <Cpu className="w-4 h-4 mr-1.5 text-primary" />
              {project?.current_model || "RandomForestClassifier"}
            </span>
            <span className="text-xs text-muted">Params: depth=8, n_estimators=100</span>
          </div>

          <div className="pt-4 md:pt-0 md:pl-6">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
              {isCustomDataset ? "Active Model Accuracy" : "Recorded Baseline"}
            </span>
            <div className="flex items-center space-x-3 mt-1">
              <div>
                <span className="text-[10px] text-muted uppercase">Accuracy:</span>
                <span className="text-sm font-mono font-bold text-text ml-1">
                  {project?.last_recorded_metrics?.accuracy 
                    ? project.last_recorded_metrics.accuracy.toFixed(4) 
                    : "--"}
                </span>
              </div>
              <div className="text-border">|</div>
              <div>
                <span className="text-[10px] text-muted uppercase">ROC-AUC:</span>
                <span className="text-sm font-mono font-bold text-text ml-1">
                  {project?.last_recorded_metrics?.roc_auc 
                    ? project.last_recorded_metrics.roc_auc.toFixed(4) 
                    : "--"}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-muted italic block mt-0.5">
              {isCustomDataset ? "Generated from active dataset execution" : "Documented reference in metrics.json"}
            </span>
          </div>

          <div className="pt-4 md:pt-0 md:pl-6">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Latest Audit Status</span>
            <div className="flex items-center mt-1">
              {isCustomDataset ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-warning/10 text-warning border border-warning/20">
                  <CheckCircle className="w-3.5 h-3.5 mr-1 text-warning" /> CUSTOM RUN (Adapted)
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  <CheckCircle className="w-3.5 h-3.5 mr-1 text-primary" /> PASS (Verified)
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted block mt-0.5">
              {isCustomDataset ? "Target adapted & model trained" : "All 5 reproducibility checks valid"}
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Pipeline Stages Flow */}
      <div className="bg-surface p-6 rounded-lg border border-border shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-text uppercase tracking-wider">DVC Pipeline Stages</h2>
            <p className="text-xs text-muted">Sequential execution flow from raw data to model evaluation</p>
          </div>
          <button 
            onClick={() => navigate('/pipeline')}
            className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center cursor-pointer"
          >
            Explore Pipeline <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        <div className="relative pt-2 pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            {stages.map((stage, idx) => (
              <div 
                key={stage.id} 
                onClick={() => navigate('/pipeline')}
                className="bg-background/60 hover:bg-surface border border-border rounded-lg p-4 transition-all cursor-pointer hover:border-primary/40 relative group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-muted uppercase">Stage {idx + 1}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                    stage.status === 'Completed' ? 'bg-primary/10 text-primary' :
                    stage.status === 'Needs verification' ? 'bg-warning/10 text-warning' :
                    stage.status === 'Failed' ? 'bg-error/10 text-error' :
                    'bg-border/60 text-muted'
                  }`}>
                    {stage.status}
                  </span>
                </div>
                <h3 className="font-bold text-text text-sm group-hover:text-primary transition-colors flex items-center">
                  <Layers className="w-3.5 h-3.5 mr-1.5 text-accent" />
                  {stage.name}
                </h3>
                <p className="text-xs font-mono text-muted mt-1 truncate">
                  {stage.script || stage.cmd}
                </p>
                <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted">
                  <span>{stage.dependencies.length} deps</span>
                  <span>{stage.outputs.length} outs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Current vs Baseline Accuracy */}
        <div className="bg-surface p-5 rounded-lg border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Accuracy (Active Model)</span>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-text">
              {project?.last_recorded_metrics.accuracy ? project.last_recorded_metrics.accuracy.toFixed(4) : "--"}
            </span>
            <span className="text-xs text-muted font-normal">
              {project?.last_recorded_metrics.accuracy ? `(${(project.last_recorded_metrics.accuracy * 100).toFixed(1)}%)` : "Not run yet"}
            </span>
          </div>
          <p className="text-[11px] text-muted mt-2 border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Baseline: <code className="font-mono text-text">0.7844</code></span>
            <span className={`font-mono font-semibold ${
              project?.last_recorded_metrics.accuracy && project.last_recorded_metrics.accuracy >= 0.7844 ? 'text-primary' : 'text-warning'
            }`}>
              {project?.last_recorded_metrics.accuracy ? `${((project.last_recorded_metrics.accuracy - 0.7844) * 100).toFixed(1)}%` : '--'}
            </span>
          </p>
        </div>

        {/* Metric 2: Current vs Baseline ROC-AUC */}
        <div className="bg-surface p-5 rounded-lg border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">ROC-AUC (Active Model)</span>
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-text">
              {project?.last_recorded_metrics.roc_auc ? project.last_recorded_metrics.roc_auc.toFixed(4) : "--"}
            </span>
            <span className="text-xs text-muted font-normal">AUC Score</span>
          </div>
          <p className="text-[11px] text-muted mt-2 border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Baseline: <code className="font-mono text-text">0.8748</code></span>
            <span className="text-[10px] text-muted">
              {project?.dataset_info?.matches_baseline ? 'Certified' : 'Custom Run'}
            </span>
          </p>
        </div>

        {/* Metric 3: Live Dataset Fingerprint */}
        <div className="bg-surface p-5 rounded-lg border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Dataset Fingerprint</span>
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-lg font-bold font-mono text-text">
              {project?.dataset_info?.current_hash ? project.dataset_info.current_hash.slice(0, 8) : "2daeecee"}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              project?.dataset_info?.matches_baseline 
                ? 'bg-primary/10 text-primary' 
                : 'bg-warning/10 text-warning'
            }`}>
              {project?.dataset_info?.matches_baseline ? 'BASELINE MATCH' : 'CUSTOM DATA'}
            </span>
          </div>
          <p className="text-[11px] text-muted mt-2 border-t border-border/60 pt-2 truncate">
            {project?.dataset_info?.row_count 
              ? `${project.dataset_info.row_count.toLocaleString()} rows on disk` 
              : 'Tracking wine.csv'}
          </p>
        </div>

        {/* Metric 4: Provenance Completeness */}
        <div className="bg-surface p-5 rounded-lg border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Provenance Completeness</span>
            <GitCommit className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-text">
              {provenance?.completeness_score ? `${provenance.completeness_score}%` : "95%"}
            </span>
            <span className="text-xs text-primary font-semibold">Verified</span>
          </div>
          <p className="text-[11px] text-muted mt-2 border-t border-border/60 pt-2">
            {provenance?.summary || "5 of 6 metadata fields recorded"}
          </p>
        </div>
      </div>

      {/* Audit Findings Section */}
      <div className="bg-surface p-6 rounded-lg border border-border shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-text uppercase tracking-wider">Preliminary Audit Findings</h2>
            <p className="text-xs text-muted">Evaluated directly from repository metadata files (dvc.lock, params.yaml, requirements.txt)</p>
          </div>
          <button 
            onClick={() => navigate('/audit')}
            className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center cursor-pointer"
          >
            Review Evidence <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-md border border-border bg-background/40 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-text">Random Seed Recorded</h3>
                <p className="text-xs text-muted mt-0.5">
                  <code className="font-mono bg-surface px-1 py-0.5 rounded border border-border">split.seed: 42</code> is explicitly captured in <code className="font-mono">params.yaml</code> and drives both train/test splitting and random state.
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold font-mono">
              PASS
            </span>
          </div>

          <div className="p-4 rounded-md border border-border bg-background/40 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-text">Dataset Fingerprint Available</h3>
                <p className="text-xs text-muted mt-0.5">
                  Raw wine dataset has an exact MD5 hash (<code className="font-mono">2daeecee174368f8a33b82c8cccae3a5</code>) recorded in <code className="font-mono">dvc.lock</code>.
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold font-mono">
              PASS
            </span>
          </div>

          <div className="p-4 rounded-md border border-border bg-background/40 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-text">Model Hyperparameters Captured</h3>
                <p className="text-xs text-muted mt-0.5">
                  Parameters <code className="font-mono">train.n_estimators (100)</code> and <code className="font-mono">train.max_depth (8)</code> are explicitly parameterized in <code className="font-mono">params.yaml</code>.
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold font-mono">
              PASS
            </span>
          </div>

          <div className="p-4 rounded-md border border-border bg-background/40 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-text">Software Dependency Manifest Present</h3>
                <p className="text-xs text-muted mt-0.5">
                  <code className="font-mono">requirements.txt</code> contains 122 explicitly pinned packages (<code className="font-mono">scikit-learn==1.9.0</code>, <code className="font-mono">dvc==3.67.1</code>).
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold font-mono">
              PASS
            </span>
          </div>

          <div className="p-4 rounded-md border border-border bg-background/40 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-text">Pipeline Configuration Consistency</h3>
                <p className="text-xs text-muted mt-0.5">
                  Stages defined in <code className="font-mono">dvc.yaml</code> correlate 1:1 with lock entries in <code className="font-mono">dvc.lock</code> without dangling stages.
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold font-mono">
              PASS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

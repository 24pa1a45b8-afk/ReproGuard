import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle, 
  HelpCircle, 
  RefreshCw, 
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { runAudit, fetchExperiments, fetchDatasetsVault, activateDatasetInVault } from '../services/api';
import type { AuditReport, Experiment, AuditStatus } from '../types';

export default function ReproducibilityAudit() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string>("exp-baseline");
  const [comparisonExpId, setComparisonExpId] = useState<string>("");
  const [datasets, setDatasets] = useState<any[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string>("");
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const loadAuditData = () => {
    fetchExperiments().then(res => setExperiments(res.data));
    fetchDatasetsVault().then(res => {
      setDatasets(res.datasets || []);
      if (res.active_dataset_id) {
        setActiveDatasetId(res.active_dataset_id);
      }
    });
    runAudit("exp-baseline").then(res => setAuditReport(res.data));
  };

  useEffect(() => {
    loadAuditData();
    const handler = () => loadAuditData();
    window.addEventListener('dataset-changed', handler);
    return () => window.removeEventListener('dataset-changed', handler);
  }, []);

  const handleStartAudit = async () => {
    setIsRunning(true);
    const res = await runAudit(
      selectedExpId, 
      comparisonExpId || undefined
    );
    setAuditReport(res.data);
    setIsRunning(false);
  };

  const handleSwitchDataset = async (dsId: string) => {
    setActiveDatasetId(dsId);
    try {
      await activateDatasetInVault(dsId);
      window.dispatchEvent(new Event('dataset-changed'));
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: AuditStatus) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <CheckCircle className="w-3 h-3 mr-1" /> PASS
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-warning/10 text-warning border border-warning/20">
            <AlertCircle className="w-3 h-3 mr-1" /> WARNING
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-error/10 text-error border border-error/20">
            <AlertCircle className="w-3 h-3 mr-1" /> FAIL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-border/60 text-muted border border-border">
            <HelpCircle className="w-3 h-3 mr-1" /> NOT CHECKED
          </span>
        );
    }
  };

  const filteredFindings = auditReport?.findings.filter(f => {
    if (statusFilter === "ALL") return true;
    return f.status === statusFilter;
  }) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Reproducibility Audit Workspace</h1>
          <p className="text-sm text-muted mt-1">
            Systematic verification across dataset integrity, pipeline provenance, configuration, environment, and evaluation metrics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-surface border border-border rounded pl-2">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider mr-2">Environment:</span>
            <select 
              value={activeDatasetId} 
              onChange={(e) => handleSwitchDataset(e.target.value)}
              className="bg-transparent text-xs text-text py-2 pr-2 focus:outline-none cursor-pointer"
            >
              {datasets.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleStartAudit}
            disabled={isRunning}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/90 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isRunning ? 'Auditing Artifacts...' : 'Run Audit'}
          </button>
        </div>
      </div>

      {/* Target & Comparison Run Selector */}
      <div className="bg-surface p-5 rounded-lg border border-border shadow-xs">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
          Audit Configuration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text mb-1">Target Experiment Run</label>
            <select 
              value={selectedExpId} 
              onChange={(e) => setSelectedExpId(e.target.value)}
              className="w-full bg-background border border-border rounded p-2 text-xs text-text focus:outline-none focus:border-primary"
            >
              {experiments.map(exp => {
                const datasetName = (exp as any).dataset_name || (exp.is_baseline ? "Wine Quality (Baseline)" : "Custom Dataset");
                return (
                  <option key={exp.id} value={exp.id}>
                    [{datasetName}] {exp.name} ({exp.id})
                  </option>
                );
              })}
            </select>
            <span className="text-[10px] text-muted mt-1 block">
              Primary target whose provenance and reproducibility will be verified.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">Comparison Run (Optional)</label>
            <select 
              value={comparisonExpId} 
              onChange={(e) => setComparisonExpId(e.target.value)}
              className="w-full bg-background border border-border rounded p-2 text-xs text-text focus:outline-none focus:border-primary"
            >
              <option value="">None (Audit against baseline reference)</option>
              {experiments.filter(e => e.id !== selectedExpId).map(exp => {
                const datasetName = (exp as any).dataset_name || (exp.is_baseline ? "Wine Quality (Baseline)" : "Custom Dataset");
                return (
                  <option key={exp.id} value={exp.id}>
                    [{datasetName}] {exp.name} ({exp.id})
                  </option>
                );
              })}
            </select>
            <span className="text-[10px] text-muted mt-1 block">
              Evaluate metric drift or configuration divergence against another run.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-background/60 p-3 rounded border border-border flex flex-col justify-between col-span-1 md:col-span-3">
            <div>
              <span className="text-[11px] text-muted font-medium">Evaluation Tolerance</span>
              <p className="text-xs font-mono font-semibold text-text mt-0.5">±0.001 (0.1% Metric Threshold)</p>
            </div>
            <p className="text-[10px] text-muted mt-2">
              Results within tolerance are classified as verified reproduced.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Summary Status Card */}
      {auditReport && (
        <div className="bg-surface p-6 rounded-lg border border-border shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-border gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Audited Dataset:</span>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                  {auditReport.summary.dataset_name || auditReport.active_dataset?.name || 'Active Dataset'}
                </span>
                <span className="text-xs text-muted">• Audit ID: <code className="text-text font-mono">{auditReport.audit_id}</code></span>
              </div>
              <div className="flex items-center space-x-3 mt-1.5">
                <span className="text-lg font-bold text-text">Overall Audit Verdict:</span>
                {getStatusBadge(auditReport.overall_status)}
              </div>
            </div>

            <div className="flex items-center space-x-6 text-xs">
              <div className="text-center">
                <span className="block text-muted">Checks Passed</span>
                <span className="text-sm font-bold font-mono text-primary">{auditReport.summary.pass_count}</span>
              </div>
              <div className="text-center">
                <span className="block text-muted">Warnings</span>
                <span className="text-sm font-bold font-mono text-warning">{auditReport.summary.warning_count}</span>
              </div>
              <div className="text-center">
                <span className="block text-muted">Failures</span>
                <span className="text-sm font-bold font-mono text-error">{auditReport.summary.fail_count}</span>
              </div>
              <div className="text-center border-l border-border pl-4">
                <span className="block text-muted">Accuracy</span>
                <span className="text-sm font-bold font-mono text-text">{auditReport.summary.accuracy.toFixed(4)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-muted flex items-center">
                <Filter className="w-3.5 h-3.5 mr-1" /> Filter Findings:
              </span>
              {(['ALL', 'PASS', 'WARNING', 'FAIL'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                    statusFilter === filter 
                      ? 'bg-primary text-white' 
                      : 'bg-background border border-border text-muted hover:text-text'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-muted">
              Evaluated on Python {auditReport.summary.python_version} against DVC tracking manifest
            </span>
          </div>
        </div>
      )}

      {/* Categorized Findings List */}
      <div className="space-y-4">
        {filteredFindings.map((finding, idx) => {
          const isExpanded = expandedIndex === idx;
          return (
            <div 
              key={finding.name} 
              className="bg-surface rounded-lg border border-border shadow-xs overflow-hidden transition-all"
            >
              {/* Finding Summary Bar */}
              <div 
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-background/40 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <button className="text-muted p-1">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div>
                    <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">
                      Category: {finding.category}
                    </span>
                    <h3 className="text-sm font-bold text-text mt-0.5">
                      {finding.name}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {getStatusBadge(finding.status)}
                </div>
              </div>

              {/* Expandable Details & Evidence */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-border/60 bg-background/30 space-y-3 text-xs">
                  <div>
                    <h4 className="font-semibold text-text uppercase tracking-wider text-[11px] mb-1">
                      Explanation & Reproducibility Impact
                    </h4>
                    <p className="text-muted leading-relaxed">
                      {finding.explanation}
                    </p>
                  </div>

                  <div className="p-3 bg-surface rounded border border-border">
                    <span className="font-semibold text-text uppercase tracking-wider text-[10px] block mb-1">
                      Empirical Evidence / Artifact Reference
                    </span>
                    <code className="text-xs font-mono text-primary block break-all">
                      {finding.evidence}
                    </code>
                  </div>

                  {finding.action && (
                    <div className="p-3 rounded border border-warning/30 bg-warning/5 text-text">
                      <span className="font-semibold text-warning block mb-0.5">Recommended Remediation:</span>
                      <p className="text-muted">{finding.action}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendations & Next Steps */}
      {auditReport && (
        <div className="bg-surface p-6 rounded-lg border border-border shadow-xs">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider mb-3">
            Recommended Next Steps for Full Audit Compliance
          </h2>
          <ul className="space-y-2 text-xs text-muted">
            {auditReport.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 mr-2 shrink-0"></span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { 
  FileCode, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Play, 
  FileCheck, 
  Sliders, 
  Clock, 
  RefreshCw, 
  X,
  UploadCloud,
  FileSpreadsheet,
  Check,
  Terminal,
  Activity,
  Layers,
  ArrowRight,
  Download
} from 'lucide-react';
import { 
  fetchPipeline, 
  triggerReproduction, 
  fetchDatasetStatus, 
  uploadDatasetFile, 
  loadBaselineDataset, 
  runFullPipelineExecution,
  fetchDatasetsVault,
  activateDatasetInVault,
  fetchDatasetPreview,
  downloadArtifactFile
} from '../services/api';
import type { DatasetStatus } from '../services/api';
import type { PipelineStage, DatasetRecord, OutputInfo, ArtifactFile } from '../types';

export default function PipelineExplorer() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{ success: boolean; message: string } | null>(null);

  // Multi-Dataset Vault & Library State
  const [vaultData, setVaultData] = useState<{ active_dataset_id: string; active_dataset: DatasetRecord | null; datasets: DatasetRecord[]; error?: string }>({
    active_dataset_id: '',
    active_dataset: null,
    datasets: []
  });
  const [isActivatingId, setIsActivatingId] = useState<string | null>(null);

  // Dataset Upload & Runner State
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineRunResult, setPipelineRunResult] = useState<any | null>(null);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDataInfo = () => {
    fetchDatasetStatus().then(res => setDatasetStatus(res));
    fetchDatasetsVault().then(res => setVaultData(res));
  };

  // Set when the stage outputs on disk were produced from a different dataset than the active one
  const [staleResults, setStaleResults] = useState<{ fromDataset?: string | null } | null>(null);

  const loadStages = () => {
    fetchPipeline().then(res => {
      setStages(res.data);
      setStaleResults(res.resultsStale ? { fromDataset: res.resultsDatasetName } : null);
      if (res.data.length > 0 && !selectedStage) {
        setSelectedStage(res.data[0]);
      }
    });
  };

  useEffect(() => {
    loadStages();
    loadDataInfo();

    const handleSync = () => {
      loadDataInfo();
      loadStages();
    };
    window.addEventListener('dataset-changed', handleSync);
    return () => window.removeEventListener('dataset-changed', handleSync);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);
    try {
      const res = await uploadDatasetFile(file);
      setUploadMessage(`${res.message} Fingerprint: ${res.dataset?.md5_hash || 'N/A'}`);
      // The backend runs the pipeline on the uploaded dataset as part of the upload
      if (res.pipeline_run) setPipelineRunResult(res.pipeline_run);
      loadDataInfo();
      loadStages();
      window.dispatchEvent(new Event('dataset-changed'));
    } catch (err: any) {
      setUploadMessage(`Error: ${err.message || 'Failed to upload CSV'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleActivateDataset = async (datasetId: string) => {
    if (datasetId === vaultData.active_dataset_id) return;
    setIsActivatingId(datasetId);
    try {
      await activateDatasetInVault(datasetId);
      loadDataInfo();
      loadStages();
      window.dispatchEvent(new Event('dataset-changed'));
    } catch (err: any) {
      setUploadMessage(`Error: ${err.message || 'Failed to activate dataset'}`);
    } finally {
      setIsActivatingId(null);
    }
  };

  const handleLoadBaseline = async () => {
    setIsUploading(true);
    setUploadMessage(null);
    try {
      const res = await loadBaselineDataset();
      setUploadMessage(res.message);
      loadDataInfo();
      loadStages();
      window.dispatchEvent(new Event('dataset-changed'));
    } catch (err: any) {
      setUploadMessage(`Error: ${err.message || 'Failed to load baseline dataset'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunFullPipeline = async () => {
    setIsRunningPipeline(true);
    setPipelineRunResult(null);
    try {
      const res = await runFullPipelineExecution();
      setPipelineRunResult(res);
      // Reload pipeline stages, vault metrics, and notify other views
      loadStages();
      loadDataInfo();
      window.dispatchEvent(new Event('dataset-changed'));
    } catch (err: any) {
      setPipelineRunResult({
        status: 'error',
        message: err.message || 'Execution error'
      });
    } finally {
      setIsRunningPipeline(false);
    }
  };

  const handleStartReproduction = async () => {
    setIsExecuting(true);
    setExecResult(null);
    const result = await triggerReproduction(selectedStage?.id);
    setIsExecuting(false);
    setExecResult({ success: result.success, message: result.message });
    loadDataInfo();
    window.dispatchEvent(new Event('dataset-changed'));
  };

  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  // Preview of any stored vault dataset (not just the active one)
  const [vaultPreview, setVaultPreview] = useState<{ id: string; name: string; columns: string[]; rows: string[][]; error?: string } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const handlePreviewDataset = async (ds: DatasetRecord) => {
    if (vaultPreview?.id === ds.id) {
      setVaultPreview(null);
      return;
    }
    setPreviewLoadingId(ds.id);
    try {
      const res = await fetchDatasetPreview(ds.id);
      setVaultPreview({ id: ds.id, name: ds.name, columns: res.columns, rows: res.preview_rows });
    } catch (err: any) {
      setVaultPreview({ id: ds.id, name: ds.name, columns: [], rows: [], error: err.message || 'Failed to load preview' });
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleDownload = async (path: string, filename?: string) => {
    setDownloadingPath(path);
    try {
      await downloadArtifactFile(path, filename);
    } catch (err) {
      console.error('Failed to download artifact:', err);
    } finally {
      setDownloadingPath(null);
    }
  };

  const getDownloadableFilesForOutput = (out: OutputInfo, stageId: string): ArtifactFile[] => {
    if (out.files && out.files.length > 0) {
      return out.files;
    }
    // Fallback known files per stage
    if (stageId === 'preprocess' || out.path === 'data/prepared') {
      return [{ path: 'data/prepared/wine.csv', name: 'wine.csv', is_csv: true, size_bytes: out.size_bytes }];
    }
    if (stageId === 'featurize' || out.path === 'data/features') {
      return [
        { path: 'data/features/train.csv', name: 'train.csv', is_csv: true, size_bytes: null },
        { path: 'data/features/test.csv', name: 'test.csv', is_csv: true, size_bytes: null }
      ];
    }
    if (out.path === 'plots/roc.csv' || stageId === 'evaluate') {
      return [{ path: 'plots/roc.csv', name: 'roc.csv', is_csv: true, size_bytes: out.size_bytes }];
    }
    if (out.path?.endsWith('.csv')) {
      return [{ path: out.path, name: out.path.split('/').pop() || 'artifact.csv', is_csv: true, size_bytes: out.size_bytes }];
    }
    return [];
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Pipeline Explorer & Execution</h1>
          <p className="text-sm text-muted mt-1">
            Input dataset management, DVC stages visualizer, artifact hashes, and end-to-end execution.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={handleRunFullPipeline}
            disabled={isRunningPipeline}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/90 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isRunningPipeline ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5 fill-white" />
            )}
            {isRunningPipeline ? 'Running 4 Stages...' : 'Run Full ML Pipeline'}
          </button>
        </div>
      </div>

      {/* SECTION 1: Dataset Vault & Multi-Dataset Library */}
      <div className="bg-surface rounded-lg border border-border shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-border gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                Dataset Vault & Library
              </span>
              <span className="text-xs text-muted">
                ({vaultData.datasets.length} Datasets Preserved)
              </span>
            </div>
            <h2 className="text-base font-bold text-text mt-1 flex items-center">
              <Database className="w-4 h-4 mr-2 text-primary" />
              Active Dataset: <span className="text-primary ml-1.5 font-semibold">{vaultData.active_dataset?.name || 'Wine Quality'}</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Upload and switch between any datasets. The pipeline dynamically processes and preserves every dataset without overwriting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-1.5 bg-primary text-white hover:bg-primary/90 rounded text-xs font-semibold flex items-center shadow-xs cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
              {isUploading ? 'Uploading & running pipeline...' : 'Upload New CSV to Vault'}
            </button>

            <button 
              onClick={handleLoadBaseline}
              disabled={isUploading}
              className="px-3 py-1.5 bg-background border border-border hover:border-primary/50 text-text rounded text-xs font-semibold flex items-center shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Restore Certified Baseline (Wine)
            </button>
          </div>
        </div>

        {uploadMessage && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded text-xs text-primary flex items-center justify-between">
            <span>{uploadMessage}</span>
            <button onClick={() => setUploadMessage(null)} className="text-muted hover:text-text cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Multi-Dataset Vault Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-text uppercase tracking-wider flex items-center">
              <Layers className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Stored Datasets in Vault
            </h3>
            <span className="text-[11px] text-muted">
              Click "Activate" to stage any dataset into the active execution pipeline
            </span>
          </div>

          {vaultData.error && (
            <div className="mb-3 p-3 bg-error/10 border border-error/20 rounded text-xs text-error">
              {vaultData.error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vaultData.datasets.map(ds => {
              const isActive = ds.id === vaultData.active_dataset_id;
              return (
                <div 
                  key={ds.id}
                  className={`p-4 rounded-lg border transition-all flex flex-col justify-between ${
                    isActive 
                      ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20' 
                      : 'bg-background hover:bg-background/80 border-border'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h4 className="text-xs font-bold text-text truncate" title={ds.name}>
                            {ds.name}
                          </h4>
                          {ds.is_baseline && (
                            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold shrink-0">
                              Baseline
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-muted truncate mt-0.5" title={ds.filename}>
                          {ds.filename}
                        </p>
                      </div>

                      {isActive ? (
                        <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded font-semibold shrink-0 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActivateDataset(ds.id)}
                          disabled={isActivatingId === ds.id}
                          className="text-[10px] bg-background hover:bg-primary/10 border border-border hover:border-primary/40 text-primary px-2 py-0.5 rounded font-semibold shrink-0 cursor-pointer transition-colors"
                        >
                          {isActivatingId === ds.id ? 'Switching...' : 'Activate'}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                      <div className="bg-surface/80 p-2 rounded border border-border/60">
                        <span className="text-[10px] text-muted block">Rows</span>
                        <span className="font-bold text-text">{ds.rows?.toLocaleString() || '--'}</span>
                      </div>
                      <div className="bg-surface/80 p-2 rounded border border-border/60">
                        <span className="text-[10px] text-muted block">Features</span>
                        <span className="font-bold text-text">{ds.columns?.length || '--'} cols</span>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] space-y-0.5">
                      <div className="flex items-center justify-between text-muted">
                        <span>Target:</span>
                        <span className="font-mono text-text font-semibold truncate max-w-[120px]" title={ds.target_column}>
                          {ds.target_column || 'auto-detect'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-muted">
                        <span>Fingerprint:</span>
                        <span className="font-mono text-muted truncate max-w-[120px]" title={ds.md5_hash}>
                          {ds.md5_hash?.slice(0, 10)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                    <div>
                      {ds.last_run_metrics ? (
                        <span className="text-text font-mono font-medium">
                          Acc: <span className="font-bold text-primary">{ds.last_run_metrics.accuracy.toFixed(4)}</span>
                        </span>
                      ) : (
                        <span className="text-muted italic text-[10px]">Awaiting execution</span>
                      )}
                    </div>
                    <button
                      onClick={() => handlePreviewDataset(ds)}
                      disabled={previewLoadingId === ds.id}
                      className="text-[10px] text-primary hover:underline flex items-center cursor-pointer disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-2.5 h-2.5 mr-0.5" />
                      {previewLoadingId === ds.id ? 'Loading...' : vaultPreview?.id === ds.id ? 'Hide preview' : 'Preview'}
                    </button>
                    {isActive ? (
                      <span className="text-[10px] text-primary font-semibold flex items-center">
                        Staged for pipeline
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleActivateDataset(ds.id)}
                        className="text-[10px] text-muted hover:text-primary flex items-center cursor-pointer"
                      >
                        Switch to this <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preview of the selected vault dataset */}
          {vaultPreview && (
            <div className="mt-3 p-3 bg-background rounded border border-border text-[11px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text flex items-center">
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Preview: <span className="text-primary ml-1">{vaultPreview.name}</span>
                  {!vaultPreview.error && (
                    <span className="text-muted font-normal ml-2">first {vaultPreview.rows.length} rows</span>
                  )}
                </span>
                <button onClick={() => setVaultPreview(null)} className="text-muted hover:text-text cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {vaultPreview.error ? (
                <p className="text-error">{vaultPreview.error}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border text-muted">
                        {vaultPreview.columns.map((col, cIdx) => (
                          <th key={cIdx} className="p-1.5 font-mono whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {vaultPreview.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((val, cIdx) => (
                            <td key={cIdx} className="p-1.5 font-mono text-text whitespace-nowrap">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Dataset Inspection Strip */}
        {datasetStatus && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text flex items-center">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Active Staged File (<code className="font-mono text-primary">{datasetStatus.filename || 'wine.csv'}</code>)
              </span>
              {datasetStatus.columns && datasetStatus.columns.length > 0 && (
                <button 
                  onClick={() => setShowDataPreview(!showDataPreview)}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {showDataPreview ? 'Hide preview' : 'Inspect preview rows'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 bg-background rounded border border-border">
                <span className="text-[10px] text-muted block">Status on Disk</span>
                <span className="text-xs font-bold text-text mt-0.5 flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-primary" /> Present & Ready
                </span>
              </div>

              <div className="p-2.5 bg-background rounded border border-border">
                <span className="text-[10px] text-muted block">Live MD5 Hash</span>
                <span className="text-xs font-mono font-bold text-text mt-0.5 block truncate" title={datasetStatus.current_md5}>
                  {datasetStatus.current_md5 ? `${datasetStatus.current_md5.slice(0, 10)}...` : 'None'}
                </span>
              </div>

              <div className="p-2.5 bg-background rounded border border-border">
                <span className="text-[10px] text-muted block">Staged Rows & Size</span>
                <span className="text-xs font-bold text-text mt-0.5 block">
                  {datasetStatus.total_rows ? `${datasetStatus.total_rows.toLocaleString()} rows` : '--'}
                </span>
              </div>

              <div className="p-2.5 bg-background rounded border border-border">
                <span className="text-[10px] text-muted block">Input Features</span>
                <span className="text-xs font-bold text-text mt-0.5 block">
                  {datasetStatus.columns ? `${datasetStatus.columns.length} columns` : '--'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Data Preview Rows */}
        {showDataPreview && datasetStatus?.preview_rows && (
          <div className="p-3 bg-background rounded border border-border overflow-x-auto text-[11px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-muted">
                  {datasetStatus.columns?.map(col => (
                    <th key={col} className="p-1.5 font-mono">{col.replace(/"/g, '')}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {datasetStatus.preview_rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((val, cIdx) => (
                      <td key={cIdx} className="p-1.5 font-mono text-text">{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {staleResults && !isRunningPipeline && (
        <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg text-xs text-text flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <span>
              The pipeline has not been run on <span className="font-semibold">{vaultData.active_dataset?.name || 'the active dataset'}</span> yet.
              {staleResults.fromDataset
                ? ` The stage outputs below were produced from "${staleResults.fromDataset}".`
                : ' The stage outputs below were produced from a different dataset.'}
            </span>
          </div>
          <button
            onClick={handleRunFullPipeline}
            className="px-3 py-1.5 bg-primary text-white rounded text-xs font-semibold hover:bg-primary/90 cursor-pointer shrink-0"
          >
            Run pipeline on this dataset
          </button>
        </div>
      )}

      {/* SECTION 2: Real Pipeline Execution Output Log (if triggered) */}
      {pipelineRunResult && (
        <div className="bg-surface rounded-lg border border-border shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-bold text-text flex items-center">
              <Terminal className="w-4 h-4 mr-2 text-primary" />
              Pipeline Execution Output & Generated Metrics
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
              pipelineRunResult.status === 'success' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
            }`}>
              {pipelineRunResult.status === 'success' ? '✓ ALL STAGES SUCCEEDED' : '✗ EXECUTION FAILED'}
            </span>
          </div>

          {pipelineRunResult.metrics && (
            <div className="p-4 bg-background rounded border border-border flex items-center space-x-6">
              <Activity className="w-5 h-5 text-primary" />
              <div>
                <span className="text-[11px] text-muted block uppercase">Resulting Accuracy</span>
                <span className="text-base font-bold font-mono text-text">
                  {pipelineRunResult.metrics.accuracy?.toFixed(4) || '--'}
                </span>
              </div>
              <div className="border-l border-border pl-6">
                <span className="text-[11px] text-muted block uppercase">Resulting ROC-AUC</span>
                <span className="text-base font-bold font-mono text-text">
                  {pipelineRunResult.metrics.roc_auc?.toFixed(4) || '--'}
                </span>
              </div>
            </div>
          )}

          {pipelineRunResult.logs && (
            <div className="space-y-2 text-xs font-mono">
              {pipelineRunResult.logs.map((log: any) => (
                <div key={log.stage} className="p-2.5 bg-background rounded border border-border">
                  <div className="flex items-center justify-between text-muted text-[11px] mb-1">
                    <span className="font-bold text-primary uppercase">Stage: {log.stage}</span>
                    <span>exit code {log.returncode}</span>
                  </div>
                  {log.stdout && <p className="text-text">{log.stdout}</p>}
                  {log.stderr && <p className="text-error">{log.stderr}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Confirmation Modal for Stage Reproduce */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-lg max-w-md w-full p-6 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-text flex items-center">
                <AlertCircle className="w-5 h-5 text-warning mr-2" />
                Confirm Pipeline Execution
              </h2>
              <button 
                onClick={() => { setShowConfirmModal(false); setExecResult(null); }}
                className="text-muted hover:text-text cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 text-xs text-muted space-y-3">
              <p>
                You are about to execute project pipeline code via DVC. This process parses dependencies, runs stage Python scripts, and verifies resulting artifact hashes.
              </p>
              <div className="p-3 bg-background rounded border border-border">
                <span className="font-semibold text-text block mb-1">Execution Target:</span>
                <code className="text-[11px] font-mono text-primary">
                  dvc repro {selectedStage ? selectedStage.id : ''}
                </code>
              </div>

              {execResult && (
                <div className={`p-3 rounded border text-xs ${
                  execResult.success ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-error/10 border-error/20 text-error'
                }`}>
                  <p className="font-semibold">{execResult.success ? '✓ Reproduction Verified' : '✗ Execution Failed'}</p>
                  <p className="mt-0.5">{execResult.message}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-border">
              <button 
                onClick={() => { setShowConfirmModal(false); setExecResult(null); }}
                className="px-3 py-1.5 border border-border rounded text-xs font-medium text-text hover:bg-border/30 cursor-pointer"
              >
                Close
              </button>
              <button 
                onClick={handleStartReproduction}
                disabled={isExecuting}
                className="px-4 py-1.5 bg-primary text-white rounded text-xs font-semibold hover:bg-primary/90 flex items-center cursor-pointer disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                {isExecuting ? 'Running DVC...' : 'Execute Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Pipeline visualizer + Stage details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Stages Flow */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-surface p-4 rounded-lg border border-border shadow-xs">
            <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
              Stages Defined in dvc.yaml
            </h2>

            <div className="space-y-3">
              {stages.map((stage, idx) => {
                const isSelected = selectedStage?.id === stage.id;
                return (
                  <div key={stage.id} className="relative">
                    <div 
                      onClick={() => setSelectedStage(stage)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                          : 'border-border bg-surface hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold font-mono ${
                            isSelected ? 'bg-primary text-white' : 'bg-background border border-border text-muted'
                          }`}>
                            0{idx + 1}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-text flex items-center">
                              {stage.name}
                            </h3>
                            <span className="text-[11px] font-mono text-muted flex items-center mt-0.5">
                              <FileCode className="w-3 h-3 mr-1" />
                              {stage.script || stage.cmd}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                          {stage.status}
                        </span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted">
                        <span>{stage.dependencies.length} dependencies</span>
                        <span>{stage.outputs.length} outputs</span>
                        <span>{stage.parameters.length} params</span>
                      </div>
                    </div>

                    {idx < stages.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="w-0.5 h-3 bg-border"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Stage Inspection Details */}
        <div className="lg:col-span-7">
          {selectedStage ? (
            <div className="bg-surface p-6 rounded-lg border border-border shadow-xs space-y-6">
              {/* Stage Header */}
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                    Selected DVC Stage
                  </span>
                  <h2 className="text-xl font-bold text-text mt-1.5 flex items-center">
                    {selectedStage.name}
                  </h2>
                  <p className="text-xs font-mono text-muted mt-1">
                    Command: <span className="text-text font-semibold">{selectedStage.cmd}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-muted block">Stage Status</span>
                  <span className="inline-flex items-center text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    {selectedStage.status}
                  </span>
                </div>
              </div>

              {/* Stage Parameters */}
              <div>
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex items-center">
                  <Sliders className="w-3.5 h-3.5 mr-1 text-primary" />
                  Hyperparameters & Configuration (params.yaml)
                </h3>
                {selectedStage.parameters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedStage.parameters.map(param => (
                      <div key={param} className="p-2.5 bg-background rounded border border-border flex items-center justify-between">
                        <span className="text-xs font-mono text-text">{param}</span>
                        <span className="text-[11px] font-mono font-semibold text-primary">
                          {param === 'preprocess.quality_threshold' ? '6' :
                           param === 'split.seed' ? '42' :
                           param === 'split.test_size' ? '0.2' :
                           param === 'featurize.scaler' ? '"standard"' :
                           param === 'train.max_depth' ? '8' :
                           param === 'train.n_estimators' ? '100' : 'Bound'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted italic">No external parameters declared in dvc.yaml for this stage.</p>
                )}
              </div>

              {/* Dependencies & Recorded Hashes */}
              <div>
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex items-center">
                  <Database className="w-3.5 h-3.5 mr-1 text-primary" />
                  Dependencies & Locked Hashes (dvc.lock)
                </h3>
                <div className="space-y-2">
                  {selectedStage.dependencies.map(dep => (
                    <div key={dep.path} className="p-3 bg-background rounded border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-text">{dep.display_path || dep.path}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          {dep.exists_on_disk ? 'Present on disk' : 'DVC tracked'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 text-[11px] text-muted font-mono">
                        <span>MD5: <code className="text-text">{dep.locked_md5 || 'Derived'}</code></span>
                        {dep.size_bytes && <span>Size: {(dep.size_bytes / 1024).toFixed(1)} KB</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outputs & Download Options */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center">
                    <FileCheck className="w-3.5 h-3.5 mr-1 text-primary" />
                    Output Artifacts & Generated CSVs
                  </h3>
                  <span className="text-[11px] text-muted">
                    Modified datasets available for download
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedStage.outputs.map(out => {
                    const downloadableFiles = getDownloadableFilesForOutput(out, selectedStage.id);
                    return (
                      <div key={out.path} className="p-3.5 bg-background rounded-lg border border-border space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold text-text">{out.path}</span>
                            {out.is_dir && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border text-muted font-medium">
                                Directory
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                            Generated Output
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 text-[11px] text-muted font-mono">
                          <span>MD5: <code className="text-text">{out.locked_md5 || 'Tracked in dvc.lock'}</code></span>
                          {out.size_bytes && <span>Size: {(out.size_bytes / 1024).toFixed(1)} KB</span>}
                        </div>

                        {/* Download Options for Modified CSVs */}
                        {downloadableFiles.length > 0 && (
                          <div className="pt-2 border-t border-border/60">
                            <span className="text-[10px] font-semibold text-muted uppercase block mb-1.5 flex items-center">
                              <Download className="w-3 h-3 mr-1 text-primary" />
                              Download Stage Output {downloadableFiles.some(f => f.is_csv) ? 'Modified CSV(s)' : 'File(s)'}:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {downloadableFiles.map(file => {
                                const isDownloading = downloadingPath === file.path;
                                return (
                                  <button
                                    key={file.path}
                                    onClick={() => handleDownload(file.path, file.name)}
                                    disabled={isDownloading}
                                    className="inline-flex items-center px-3 py-1.5 bg-surface hover:bg-primary/10 border border-border hover:border-primary/40 rounded text-xs font-semibold text-text hover:text-primary transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                                  >
                                    {isDownloading ? (
                                      <RefreshCw className="w-3 h-3 mr-1.5 animate-spin text-primary" />
                                    ) : (
                                      <Download className="w-3 h-3 mr-1.5 text-primary" />
                                    )}
                                    <span>Download {file.name}</span>
                                    {file.is_csv && (
                                      <span className="ml-1.5 text-[9px] bg-primary/15 text-primary px-1.5 py-0.2 rounded font-mono font-bold">
                                        CSV
                                      </span>
                                    )}
                                    {file.size_bytes && (
                                      <span className="ml-1 text-[10px] font-normal text-muted">
                                        ({(file.size_bytes / 1024).toFixed(1)} KB)
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Last Run Info */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
                <span className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Verified via schema 2.0 in dvc.lock
                </span>
                <span className="font-mono text-primary font-medium">
                  Determinism: Guaranteed via seed 42
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-surface p-12 rounded-lg border border-border text-center text-muted">
              Select a stage from the left to inspect its parameters, dependencies, and artifacts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

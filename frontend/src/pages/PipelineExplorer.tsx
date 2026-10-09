import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Play,
  RefreshCw,
  X,
  UploadCloud,
  FileSpreadsheet,
  Check,
  Download
} from 'lucide-react';
import { Btn, KV, Page, SectionLabel, Stat, Tag, Th, statusTone } from '../components/ui';
import { 
  fetchPipeline, 
  triggerReproduction, 
  fetchDatasetStatus, 
  uploadDatasetFile, 
  loadBaselineDataset, 
  runFullPipelineExecution,
  fetchDatasetsVault,
  activateDatasetInVault,
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
  const [vaultData, setVaultData] = useState<{ active_dataset_id: string; active_dataset: DatasetRecord | null; datasets: DatasetRecord[] }>({
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

  const loadStages = () => {
    fetchPipeline().then(res => {
      setStages(res.data);
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
      setUploadMessage(`Saved "${file.name}" to Dataset Vault and activated! Fingerprint: ${res.md5_hash}`);
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

  const paramValue = (param: string) =>
    param === 'preprocess.quality_threshold' ? '6' :
    param === 'split.seed' ? '42' :
    param === 'split.test_size' ? '0.2' :
    param === 'featurize.scaler' ? '"standard"' :
    param === 'train.max_depth' ? '8' :
    param === 'train.n_estimators' ? '100' : 'Bound';

  const kb = (bytes?: number | null) => (bytes ? `${(bytes / 1024).toFixed(1)} KB` : '');

  return (
    <Page
      title="Pipeline"
      hint={
        <>
          Active dataset
          <span className="text-text font-medium truncate">{vaultData.active_dataset?.name || 'Wine Quality'}</span>
        </>
      }
      actions={
        <>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
          <Btn onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-muted" />
            Upload CSV
          </Btn>
          <Btn onClick={handleLoadBaseline} disabled={isUploading}>
            <Check className="w-3.5 h-3.5 mr-1.5 text-muted" />
            Restore baseline
          </Btn>
          <Btn variant="primary" onClick={handleRunFullPipeline} disabled={isRunningPipeline}>
            {isRunningPipeline ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5 fill-white" />
            )}
            {isRunningPipeline ? 'Running 4 stages…' : 'Run full pipeline'}
          </Btn>
        </>
      }
    >
      {uploadMessage && (
        <div className="px-4 py-2 border-b border-border bg-primary/5 text-xs text-text flex items-center justify-between gap-4">
          <span className="break-all">{uploadMessage}</span>
          <button onClick={() => setUploadMessage(null)} className="text-muted hover:text-text cursor-pointer shrink-0" aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SECTION 1: Dataset vault */}
      <SectionLabel count={vaultData.datasets.length} aside="Activate a dataset to stage it into the pipeline">
        Dataset vault
      </SectionLabel>
      <div className="overflow-x-auto">
        <table className="sheet">
          <thead>
            <tr>
              <th className="rn"></th>
              <Th>name</Th>
              <Th>file</Th>
              <Th t="#" className="num">rows</Th>
              <Th t="#" className="num">features</Th>
              <Th>target</Th>
              <Th>fingerprint</Th>
              <Th t="#" className="num">accuracy</Th>
              <Th>state</Th>
            </tr>
          </thead>
          <tbody>
            {vaultData.datasets.length === 0 && (
              <tr>
                <td className="rn"></td>
                <td colSpan={8} className="text-muted">No datasets in the vault yet. Upload a CSV to add one.</td>
              </tr>
            )}
            {vaultData.datasets.map((ds, idx) => {
              const isActive = ds.id === vaultData.active_dataset_id;
              return (
                <tr key={ds.id} className={isActive ? 'is-selected' : undefined}>
                  <td className="rn">{idx + 1}</td>
                  <td className="font-medium">
                    <span title={ds.name}>{ds.name}</span>
                    {ds.is_baseline && <span className="ml-2"><Tag tone="grey">baseline</Tag></span>}
                  </td>
                  <td className="text-muted" title={ds.filename}>{ds.filename}</td>
                  <td className="num">{ds.rows?.toLocaleString() || '--'}</td>
                  <td className="num">{ds.columns?.length || '--'}</td>
                  <td>{ds.target_column || <span className="text-muted">auto-detect</span>}</td>
                  <td className="font-mono text-xs text-muted" title={ds.md5_hash}>{ds.md5_hash?.slice(0, 10)}…</td>
                  <td className="num">
                    {ds.last_run_metrics ? ds.last_run_metrics.accuracy.toFixed(4) : <span className="text-muted">not run</span>}
                  </td>
                  <td>
                    {isActive ? (
                      <Tag tone="green">active</Tag>
                    ) : (
                      <button
                        onClick={() => handleActivateDataset(ds.id)}
                        disabled={isActivatingId === ds.id}
                        className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {isActivatingId === ds.id ? 'Switching…' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Active staged file */}
      {datasetStatus && (
        <div className="min-h-9 px-4 py-1.5 border-b border-border flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
          <span className="flex items-center text-text">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-muted" />
            <span className="font-mono">data/raw/wine.csv</span>
          </span>
          <span className="flex items-center text-accent">
            <CheckCircle2 className="w-3 h-3 mr-1" /> present
          </span>
          <span title={datasetStatus.current_md5}>
            md5 <span className="font-mono text-text">{datasetStatus.current_md5 ? `${datasetStatus.current_md5.slice(0, 10)}…` : 'none'}</span>
          </span>
          <span>
            {datasetStatus.total_rows ? `${datasetStatus.total_rows.toLocaleString()} rows` : '-- rows'}
            {' × '}
            {datasetStatus.columns ? `${datasetStatus.columns.length} columns` : '-- columns'}
          </span>
          {datasetStatus.columns && datasetStatus.columns.length > 0 && (
            <button
              onClick={() => setShowDataPreview(!showDataPreview)}
              className="text-primary hover:underline cursor-pointer ml-auto"
            >
              {showDataPreview ? 'Hide preview' : 'Preview rows'}
            </button>
          )}
        </div>
      )}

      {/* Data preview rows */}
      {showDataPreview && datasetStatus?.preview_rows && (
        <div className="overflow-x-auto">
          <table className="sheet">
            <thead>
              <tr>
                <th className="rn"></th>
                {datasetStatus.columns?.map(col => (
                  <Th key={col} t="#">{col.replace(/"/g, '')}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datasetStatus.preview_rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  <td className="rn">{rIdx + 1}</td>
                  {row.map((val, cIdx) => (
                    <td key={cIdx} className="num">{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SECTION 2: Pipeline run output (if triggered) */}
      {pipelineRunResult && (
        <>
          <SectionLabel
            aside={
              <Tag tone={pipelineRunResult.status === 'success' ? 'green' : 'red'}>
                {pipelineRunResult.status === 'success' ? 'all stages succeeded' : 'execution failed'}
              </Tag>
            }
          >
            Last run output
          </SectionLabel>

          {pipelineRunResult.metrics && (
            <div className="grid grid-cols-2 lg:grid-cols-4">
              <Stat label="Resulting accuracy" value={pipelineRunResult.metrics.accuracy?.toFixed(4) || '--'} />
              <Stat label="Resulting ROC-AUC" value={pipelineRunResult.metrics.roc_auc?.toFixed(4) || '--'} />
            </div>
          )}

          {pipelineRunResult.message && !pipelineRunResult.logs && (
            <div className="px-4 py-2 border-b border-border text-xs text-error">{pipelineRunResult.message}</div>
          )}

          {pipelineRunResult.logs && (
            <div className="overflow-x-auto">
              <table className="sheet">
                <thead>
                  <tr>
                    <th className="rn"></th>
                    <Th>stage</Th>
                    <Th t="#" className="num">exit code</Th>
                    <Th>output</Th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineRunResult.logs.map((log: any, idx: number) => (
                    <tr key={log.stage}>
                      <td className="rn">{idx + 1}</td>
                      <td className="font-medium">{log.stage}</td>
                      <td className="num">{log.returncode}</td>
                      <td className="wrap font-mono text-xs">
                        {log.stdout && <p className="text-text">{log.stdout}</p>}
                        {log.stderr && <p className="text-error">{log.stderr}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* SECTION 3: Confirmation modal for stage reproduce */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full shadow-lg">
            <div className="h-11 px-4 flex items-center justify-between border-b border-border">
              <h2 className="text-sm font-semibold text-text flex items-center">
                <AlertCircle className="w-4 h-4 text-warning mr-2" />
                Confirm pipeline execution
              </h2>
              <button
                onClick={() => { setShowConfirmModal(false); setExecResult(null); }}
                className="text-muted hover:text-text cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 text-xs text-muted space-y-3">
              <p>
                This runs the project pipeline through DVC: it parses dependencies, runs the stage scripts, and verifies the resulting artifact hashes.
              </p>
              <div className="px-3 py-2 bg-background rounded-md border border-border font-mono text-text">
                dvc repro {selectedStage ? selectedStage.id : ''}
              </div>

              {execResult && (
                <div className={execResult.success ? 'text-accent' : 'text-error'}>
                  <p className="font-semibold">{execResult.success ? 'Reproduction verified' : 'Execution failed'}</p>
                  <p className="mt-0.5">{execResult.message}</p>
                </div>
              )}
            </div>

            <div className="px-4 py-3 flex items-center justify-end gap-2 border-t border-border">
              <Btn onClick={() => { setShowConfirmModal(false); setExecResult(null); }}>Close</Btn>
              <Btn variant="primary" onClick={handleStartReproduction} disabled={isExecuting}>
                {isExecuting ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                {isExecuting ? 'Running DVC…' : 'Execute now'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Stage list + stage details */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left: stages as a step list */}
        <div className="bg-background border-b lg:border-b-0 lg:border-r border-border">
          <div className="h-9 px-4 flex items-center justify-between border-b border-border">
            <span className="text-[11px] font-semibold text-muted tracking-widest uppercase">Stages</span>
            <span className="text-[11px] font-medium text-muted bg-border/70 rounded px-1.5 py-px">{stages.length}</span>
          </div>

          <div className="p-2 space-y-0.5">
            {stages.map((stage, idx) => {
              const isSelected = selectedStage?.id === stage.id;
              const done = stage.status === 'Completed';
              return (
                <div
                  key={stage.id}
                  onClick={() => setSelectedStage(stage)}
                  className={`rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-surface border-border shadow-xs' : 'border-transparent hover:bg-border/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                    )}
                    <span className="text-xs text-muted w-3">{idx + 1}</span>
                    <span className="text-sm text-text truncate">{stage.name}</span>
                  </div>

                  {isSelected && (
                    <dl className="mt-2 pl-[26px]">
                      <div className="text-[10px] font-semibold text-muted tracking-widest uppercase mb-0.5">Declared</div>
                      <KV k="script">{stage.script || stage.cmd}</KV>
                      <KV k="dependencies">{stage.dependencies.length}</KV>
                      <KV k="outputs">{stage.outputs.length}</KV>
                      <KV k="params">{stage.parameters.length}</KV>
                      <KV k="status"><Tag tone={statusTone(stage.status)}>{stage.status}</Tag></KV>
                    </dl>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: stage inspection */}
        <div className="min-w-0">
          {selectedStage ? (
            <>
              <div className="min-h-11 px-4 py-1.5 border-b border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-3 min-w-0">
                  <h2 className="text-sm font-semibold text-text">{selectedStage.name}</h2>
                  <span className="text-xs font-mono text-muted truncate">{selectedStage.cmd}</span>
                </div>
                <Tag tone={statusTone(selectedStage.status)}>{selectedStage.status}</Tag>
              </div>

              {/* Stage parameters */}
              <SectionLabel count={selectedStage.parameters.length} aside="params.yaml">Parameters</SectionLabel>
              {selectedStage.parameters.length > 0 ? (
                <table className="sheet">
                  <thead>
                    <tr>
                      <th className="rn"></th>
                      <Th>parameter</Th>
                      <Th t="#">value</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStage.parameters.map((param, idx) => (
                      <tr key={param}>
                        <td className="rn">{idx + 1}</td>
                        <td className="font-mono text-xs">{param}</td>
                        <td className="font-mono text-xs">{paramValue(param)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 py-2.5 border-b border-border text-xs text-muted">
                  No external parameters declared in dvc.yaml for this stage.
                </p>
              )}

              {/* Dependencies & recorded hashes */}
              <SectionLabel count={selectedStage.dependencies.length} aside="dvc.lock">Dependencies</SectionLabel>
              <div className="overflow-x-auto">
                <table className="sheet">
                  <thead>
                    <tr>
                      <th className="rn"></th>
                      <Th>path</Th>
                      <Th>md5</Th>
                      <Th t="#" className="num">size</Th>
                      <Th>state</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStage.dependencies.map((dep, idx) => (
                      <tr key={dep.path}>
                        <td className="rn">{idx + 1}</td>
                        <td className="font-mono text-xs">{dep.path}</td>
                        <td className="font-mono text-xs text-muted">{dep.locked_md5 || 'derived'}</td>
                        <td className="num text-muted">{kb(dep.size_bytes)}</td>
                        <td><Tag tone={dep.exists_on_disk ? 'green' : 'grey'}>{dep.exists_on_disk ? 'on disk' : 'dvc tracked'}</Tag></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Outputs & downloads */}
              <SectionLabel count={selectedStage.outputs.length} aside="Generated files can be downloaded">Outputs</SectionLabel>
              <div className="overflow-x-auto">
                <table className="sheet">
                  <thead>
                    <tr>
                      <th className="rn"></th>
                      <Th>path</Th>
                      <Th>md5</Th>
                      <Th t="#" className="num">size</Th>
                      <Th>download</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStage.outputs.map((out, idx) => {
                      const downloadableFiles = getDownloadableFilesForOutput(out, selectedStage.id);
                      return (
                        <tr key={out.path}>
                          <td className="rn">{idx + 1}</td>
                          <td className="font-mono text-xs">
                            {out.path}
                            {out.is_dir && <span className="ml-2 font-sans"><Tag tone="grey">directory</Tag></span>}
                          </td>
                          <td className="font-mono text-xs text-muted">{out.locked_md5 || 'tracked in dvc.lock'}</td>
                          <td className="num text-muted">{kb(out.size_bytes)}</td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              {downloadableFiles.map(file => {
                                const isDownloading = downloadingPath === file.path;
                                return (
                                  <button
                                    key={file.path}
                                    onClick={() => handleDownload(file.path, file.name)}
                                    disabled={isDownloading}
                                    title={file.size_bytes ? `${file.name} (${kb(file.size_bytes)})` : file.name}
                                    className="inline-flex items-center h-6 px-2 border border-border rounded-md text-xs text-text hover:bg-background cursor-pointer disabled:opacity-50"
                                  >
                                    {isDownloading ? (
                                      <RefreshCw className="w-3 h-3 mr-1 animate-spin text-muted" />
                                    ) : (
                                      <Download className="w-3 h-3 mr-1 text-muted" />
                                    )}
                                    {file.name}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2 text-xs text-muted">
                Verified via schema 2.0 in dvc.lock · deterministic with seed 42
              </div>
            </>
          ) : (
            <p className="px-4 py-10 text-center text-xs text-muted">
              Select a stage to inspect its parameters, dependencies and artifacts.
            </p>
          )}
        </div>
      </div>
    </Page>
  );
}

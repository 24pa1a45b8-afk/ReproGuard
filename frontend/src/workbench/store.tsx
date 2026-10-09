import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  fetchArtifactBlob,
  fetchDatasetStatus,
  fetchProject,
  runAudit,
  runFullPipelineExecution,
  uploadDatasetFile,
} from '../services/api';
import type { AuditReport, ProjectInfo } from '../types';
import { buildWorkbenchFindings, overallStatus } from './audit';
import type { WorkbenchFinding } from './audit';
import { OP_BY_ID } from './ops';
import type { OpResult, Params } from './ops';
import {
  CsvError,
  MAX_FILE_BYTES,
  cellCount,
  downloadBlob,
  fingerprintTable,
  parseCsv,
  schemaOf,
  sha256Hex,
  toCsvParts,
} from './table';
import type { Table } from './table';

export interface Step {
  id: string;
  op: string;
  params: Params;
  appliedAt: string;
  enabled: boolean;
}

export interface StepRun {
  step: Step;
  index: number;
  title: string;
  status: 'ok' | 'error' | 'disabled';
  error?: string;
  input: Table;
  output: Table;
  rowsAffected: number;
  changed: OpResult['changed'];
  learned: OpResult['learned'];
}

export interface Source {
  name: string;
  kind: 'upload' | 'pipeline';
  loadedAt: string;
  sizeBytes: number;
  sha256: string;
  delimiter: string;
  warnings: string[];
}

export interface Reproduction {
  at: string;
  runId?: string;
  metrics: { accuracy?: number; roc_auc?: number };
  baseline: { accuracy: number; roc_auc: number };
  logs?: { stage: string; stdout: string; stderr: string; returncode: number }[];
}

export type TabId = 'working' | 'original' | 'train' | 'metadata';
export interface Selection {
  row: number | null;
  col: number;
}
export interface Notice {
  kind: 'error' | 'info' | 'success';
  text: string;
}

/** Above this many cells, fingerprints are computed only when asked for. */
const AUTO_FINGERPRINT_CELLS = 3_000_000;
const PIPELINE_DATASET = 'data/raw/wine.csv';
const TRAIN_SET = 'data/features/train.csv';

function replay(original: Table, steps: Step[], cache: Map<string, StepRun>): { working: Table; runs: StepRun[]; cache: Map<string, StepRun> } {
  const next = new Map<string, StepRun>();
  const runs: StepRun[] = [];
  let table = original;
  let key = '';
  steps.forEach((step, index) => {
    const def = OP_BY_ID[step.op];
    const title = def ? def.title(step.params) : step.op;
    if (!step.enabled) {
      runs.push({ step, index, title, status: 'disabled', input: table, output: table, rowsAffected: 0, changed: [], learned: {} });
      return;
    }
    key += '|' + step.id;
    let run = cache.get(key);
    if (!run || run.input !== table) {
      try {
        if (!def) throw new Error(`Unknown operation "${step.op}".`);
        const res = def.apply(table, step.params);
        run = { step, index, title, status: 'ok', input: table, output: res.table, rowsAffected: res.rowsAffected, changed: res.changed, learned: res.learned };
      } catch (err) {
        run = {
          step,
          index,
          title,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          input: table,
          output: table,
          rowsAffected: 0,
          changed: [],
          learned: {},
        };
      }
    } else if (run.index !== index || run.step !== step) {
      run = { ...run, step, index };
    }
    next.set(key, run);
    runs.push(run);
    table = run.output;
  });
  return { working: table, runs, cache: next };
}

const signature = (steps: Step[]) => steps.map(s => `${s.id}:${s.enabled ? 1 : 0}`).join('|');
const stem = (name: string) => name.replace(/\.[^.]+$/, '');

interface Workbench {
  source: Source | null;
  original: Table | null;
  working: Table | null;
  steps: Step[];
  runs: StepRun[];
  loading: string | null;
  notice: Notice | null;
  setNotice: (n: Notice | null) => void;

  backendLive: boolean | null;
  project: { data: ProjectInfo; isReal: boolean } | null;

  importFile: (file: File) => Promise<void>;
  loadFromPipeline: (announce?: boolean) => Promise<void>;

  /** Applies an operation to the working dataset and records it. Returns an error message, or null on success. */
  applyOp: (opId: string, params: Params) => string | null;
  deleteStep: (id: string) => void;
  toggleStep: (id: string) => void;
  moveStep: (id: string, delta: -1 | 1) => void;
  clearSteps: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  selectedStepId: string | null;
  setSelectedStepId: (id: string | null) => void;

  tab: TabId;
  setTab: (t: TabId) => void;
  trainAvailable: boolean;
  viewTable: Table | null;
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;

  search: string;
  setSearch: (s: string) => void;
  searchOpen: boolean;
  setSearchOpen: (b: boolean) => void;

  dialog: { opId: string; params?: Params } | null;
  openOp: (opId: string, params?: Params) => void;
  closeDialog: () => void;
  qualityOpen: boolean;
  setQualityOpen: (b: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (b: boolean) => void;
  leftOpen: boolean;
  setLeftOpen: (b: boolean) => void;
  rightOpen: boolean;
  setRightOpen: (b: boolean) => void;

  workingSha: string | null;
  dirty: boolean;
  syncedAt: string | null;

  exportCsv: () => void;
  exportHistory: () => Promise<void>;
  exportMetadata: () => Promise<void>;
  exportAudit: () => void;
  buildMetadata: () => Record<string, unknown>;
  sendToPipeline: () => Promise<void>;

  audit: { report: AuditReport; isReal: boolean } | null;
  auditRunning: boolean;
  runAuditNow: (experimentId?: string, comparisonId?: string) => Promise<void>;
  reproduction: Reproduction | null;
  reproducing: boolean;
  rerunPipeline: () => Promise<void>;
  findings: WorkbenchFinding[];
}

const Ctx = createContext<Workbench | null>(null);

export function useWorkbench(): Workbench {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkbench must be used inside WorkbenchProvider');
  return ctx;
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<Source | null>(null);
  const [original, setOriginal] = useState<Table | null>(null);
  const [history, setHistory] = useState<{ steps: Step[]; past: Step[][]; future: Step[][] }>({ steps: [], past: [], future: [] });
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [backendLive, setBackendLive] = useState<boolean | null>(null);
  const [project, setProject] = useState<{ data: ProjectInfo; isReal: boolean } | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [tab, setTabState] = useState<TabId>('working');
  const [trainBlob, setTrainBlob] = useState<Blob | null>(null);
  const [trainTable, setTrainTable] = useState<Table | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialog, setDialog] = useState<{ opId: string; params?: Params } | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth >= 900);
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 1200);
  const [workingSha, setWorkingSha] = useState<string | null>(null);
  const [savedSig, setSavedSig] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [audit, setAudit] = useState<{ report: AuditReport; isReal: boolean } | null>(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const [reproduction, setReproduction] = useState<Reproduction | null>(null);
  const [reproducing, setReproducing] = useState(false);

  const steps = history.steps;
  const cacheRef = useRef(new Map<string, StepRun>());
  const counterRef = useRef(0);
  const stateRef = useRef({ source, steps });
  stateRef.current = { source, steps };

  const { working, runs } = useMemo(() => {
    if (!original) return { working: null as Table | null, runs: [] as StepRun[] };
    const out = replay(original, steps, cacheRef.current);
    cacheRef.current = out.cache;
    return { working: out.working, runs: out.runs };
  }, [original, steps]);

  const dirty = signature(steps) !== savedSig;

  // Side panels give way to the grid when the window gets narrow.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1100) setRightOpen(false);
      if (window.innerWidth < 760) setLeftOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Auto-dismiss notices
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.kind === 'error' ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [notice]);

  // Fingerprint of the working dataset
  useEffect(() => {
    setWorkingSha(null);
    if (!working || cellCount(working) > AUTO_FINGERPRINT_CELLS) return;
    let stale = false;
    const t = setTimeout(() => {
      fingerprintTable(working).then(h => {
        if (!stale) setWorkingSha(h);
      });
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [working]);

  const adopt = useCallback((table: Table, src: Source) => {
    cacheRef.current = new Map();
    setOriginal(table);
    setSource(src);
    setHistory({ steps: [], past: [], future: [] });
    setSavedSig('');
    setSyncedAt(null);
    setSelectedStepId(null);
    setSelection(null);
    setSearch('');
    setTabState('working');
  }, []);

  const refreshBackend = useCallback(async () => {
    const proj = await fetchProject();
    setProject(proj);
    setBackendLive(proj.isReal);
    const train = proj.isReal ? await fetchArtifactBlob(TRAIN_SET) : null;
    setTrainBlob(train);
    setTrainTable(null);
    return proj.isReal;
  }, []);

  const loadFromPipeline = useCallback(async (announce = false) => {
    setLoading('Loading the pipeline dataset…');
    try {
      const blob = await fetchArtifactBlob(PIPELINE_DATASET);
      if (!blob) {
        if (announce) setNotice({ kind: 'error', text: 'The backend is not reachable, so the pipeline dataset could not be loaded. Import a CSV instead.' });
        return;
      }
      const buf = await blob.arrayBuffer();
      const parsed = parseCsv(new TextDecoder().decode(buf));
      const status = await fetchDatasetStatus();
      adopt(parsed.table, {
        name: status.filename || 'wine.csv',
        kind: 'pipeline',
        loadedAt: new Date().toISOString(),
        sizeBytes: buf.byteLength,
        sha256: await sha256Hex(buf),
        delimiter: parsed.delimiter,
        warnings: parsed.warnings,
      });
      if (announce) setNotice({ kind: 'success', text: 'Loaded the pipeline\'s active dataset.' });
    } catch (err) {
      setNotice({ kind: 'error', text: `The pipeline dataset could not be read: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(null);
    }
  }, [adopt]);

  const importFile = useCallback(async (file: File) => {
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
      setNotice({ kind: 'error', text: `"${file.name}" is not a CSV file. Choose a .csv, .tsv or .txt file.` });
      return;
    }
    if (file.size === 0) {
      setNotice({ kind: 'error', text: `"${file.name}" is empty.` });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setNotice({
        kind: 'error',
        text: `"${file.name}" is ${(file.size / 1048576).toFixed(0)} MB. The workspace loads files up to ${MAX_FILE_BYTES / 1048576} MB.`,
      });
      return;
    }
    setLoading(`Reading ${file.name}…`);
    // Let the loading state paint before the synchronous parse.
    await new Promise(r => setTimeout(r, 30));
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseCsv(new TextDecoder().decode(buf));
      adopt(parsed.table, {
        name: file.name,
        kind: 'upload',
        loadedAt: new Date().toISOString(),
        sizeBytes: file.size,
        sha256: await sha256Hex(buf),
        delimiter: parsed.delimiter,
        warnings: parsed.warnings,
      });
      setNotice(
        parsed.warnings.length > 0
          ? { kind: 'info', text: parsed.warnings.join(' ') }
          : { kind: 'success', text: `Imported ${file.name}: ${parsed.table.nrows.toLocaleString()} rows × ${parsed.table.columns.length} columns.` }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ kind: 'error', text: err instanceof CsvError ? `Could not import ${file.name}. ${msg}` : `Could not read ${file.name}: ${msg}` });
    } finally {
      setLoading(null);
    }
  }, [adopt]);

  // Initial load, and resync when another page switches the pipeline's dataset.
  useEffect(() => {
    refreshBackend().then(live => {
      if (live) loadFromPipeline();
    });
    const handler = () => {
      refreshBackend().then(live => {
        const { source: src, steps: st } = stateRef.current;
        if (live && st.length === 0 && (!src || src.kind === 'pipeline')) loadFromPipeline();
      });
    };
    window.addEventListener('dataset-changed', handler);
    return () => window.removeEventListener('dataset-changed', handler);
  }, [refreshBackend, loadFromPipeline]);

  // Parse the train split only when its tab is opened.
  useEffect(() => {
    if (tab !== 'train' || trainTable || !trainBlob) return;
    let stale = false;
    trainBlob.text().then(text => {
      if (stale) return;
      try {
        setTrainTable(parseCsv(text).table);
      } catch (err) {
        setNotice({ kind: 'error', text: `The train split could not be read: ${err instanceof Error ? err.message : String(err)}` });
        setTabState('working');
      }
    });
    return () => {
      stale = true;
    };
  }, [tab, trainBlob, trainTable]);

  const commit = useCallback((next: Step[]) => {
    setHistory(h => ({ steps: next, past: [...h.past, h.steps], future: [] }));
  }, []);

  const applyOp = useCallback((opId: string, params: Params): string | null => {
    const def = OP_BY_ID[opId];
    if (!def || !working) return 'No dataset is loaded.';
    let res: OpResult;
    try {
      res = def.apply(working, params);
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
    const step: Step = {
      id: `step_${String(++counterRef.current).padStart(3, '0')}`,
      op: opId,
      params,
      appliedAt: new Date().toISOString(),
      enabled: true,
    };
    // Seed the replay cache so the operation is not computed twice.
    const key = steps.filter(s => s.enabled).map(s => '|' + s.id).join('') + '|' + step.id;
    cacheRef.current.set(key, {
      step,
      index: steps.length,
      title: def.title(params),
      status: 'ok',
      input: working,
      output: res.table,
      rowsAffected: res.rowsAffected,
      changed: res.changed,
      learned: res.learned,
    });
    commit([...steps, step]);
    setSelectedStepId(step.id);
    setTabState('working');
    setSelection(null);
    return null;
  }, [working, steps, commit]);

  const deleteStep = useCallback((id: string) => commit(steps.filter(s => s.id !== id)), [steps, commit]);
  const toggleStep = useCallback(
    (id: string) => commit(steps.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))),
    [steps, commit]
  );
  const moveStep = useCallback((id: string, delta: -1 | 1) => {
    const i = steps.findIndex(s => s.id === id);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }, [steps, commit]);
  const clearSteps = useCallback(() => {
    if (steps.length > 0) commit([]);
  }, [steps, commit]);

  const undo = useCallback(() => {
    setHistory(h => (h.past.length === 0 ? h : { steps: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.steps, ...h.future] }));
    setSelection(null);
  }, []);
  const redo = useCallback(() => {
    setHistory(h => (h.future.length === 0 ? h : { steps: h.future[0], past: [...h.past, h.steps], future: h.future.slice(1) }));
    setSelection(null);
  }, []);

  const setTab = useCallback((t: TabId) => {
    setTabState(t);
    setSelection(null);
  }, []);

  const viewTable = tab === 'original' ? original : tab === 'train' ? trainTable : tab === 'working' ? working : null;

  const openOp = useCallback((opId: string, params?: Params) => setDialog({ opId, params }), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const buildMetadata = useCallback((): Record<string, unknown> => {
    return {
      generated_at: new Date().toISOString(),
      tool: 'ReproGuard',
      original_dataset: source && original
        ? {
            name: source.name,
            source: source.kind === 'pipeline' ? 'pipeline active dataset (data/raw/wine.csv)' : 'file imported in the browser',
            loaded_at: source.loadedAt,
            size_bytes: source.sizeBytes,
            sha256: source.sha256,
            delimiter: source.delimiter,
            rows: original.nrows,
            columns: original.columns.length,
            schema: schemaOf(original),
          }
        : null,
      working_dataset: working
        ? {
            rows: working.nrows,
            columns: working.columns.length,
            schema: schemaOf(working),
            sha256_of_exported_csv: workingSha,
            sent_to_pipeline_at: syncedAt,
            has_unsaved_changes: dirty,
          }
        : null,
      transformation_steps: runs.map(r => ({
        step_id: r.step.id,
        operation: r.step.op,
        parameters: r.step.params,
        enabled: r.step.enabled,
        status: r.status,
      })),
      pipeline: project?.isReal
        ? {
            source: 'live backend',
            repository: project.data.repository,
            branch: project.data.branch,
            model: project.data.current_model,
            parameters: project.data.parameters,
            baseline_metrics: project.data.baseline_metrics,
            last_recorded_metrics: project.data.last_recorded_metrics,
          }
        : { source: 'unavailable (backend offline)' },
      reproduction_attempt: reproduction,
    };
  }, [source, original, working, workingSha, syncedAt, dirty, runs, project, reproduction]);

  const exportCsv = useCallback(() => {
    if (!working || !source) return;
    downloadBlob(new Blob(toCsvParts(working), { type: 'text/csv;charset=utf-8' }), `${stem(source.name)}_working.csv`);
    setSavedSig(signature(steps));
  }, [working, source, steps]);

  const exportHistory = useCallback(async () => {
    if (!source || !original) return;
    const small = cellCount(original) <= AUTO_FINGERPRINT_CELLS;
    const out = [];
    for (const r of runs) {
      out.push({
        step_id: r.step.id,
        position: r.index + 1,
        operation: r.step.op,
        description: r.title,
        columns: OP_BY_ID[r.step.op]?.columnsOf(r.step.params) ?? [],
        parameters: r.step.params,
        applied_at: r.step.appliedAt,
        enabled: r.step.enabled,
        status: r.status,
        error: r.error ?? null,
        rows_before: r.input.nrows,
        rows_after: r.output.nrows,
        rows_affected: r.rowsAffected,
        changed_columns: r.changed,
        learned: r.learned,
        input_schema: schemaOf(r.input),
        output_schema: schemaOf(r.output),
        input_fingerprint: small ? await fingerprintTable(r.input) : null,
        output_fingerprint: small ? await fingerprintTable(r.output) : null,
      });
    }
    const doc = {
      generated_at: new Date().toISOString(),
      original_dataset: { name: source.name, sha256: source.sha256, rows: original.nrows, columns: original.columns.length },
      fingerprint_method: small
        ? 'SHA-256 of the table serialised as comma-separated UTF-8 text'
        : 'not computed: dataset exceeds the automatic fingerprint size',
      steps: out,
    };
    downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${stem(source.name)}_transformation_history.json`);
  }, [source, original, runs]);

  const exportMetadata = useCallback(async () => {
    const meta = buildMetadata();
    if (working && !workingSha) {
      (meta.working_dataset as Record<string, unknown>).sha256_of_exported_csv = await fingerprintTable(working);
    }
    downloadBlob(new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' }), `${stem(source?.name || 'reproguard')}_experiment_metadata.json`);
  }, [buildMetadata, working, workingSha, source]);

  const sendToPipeline = useCallback(async () => {
    if (!working || !source) return;
    setLoading('Sending the working dataset to the pipeline…');
    try {
      const file = new File(toCsvParts(working), `${stem(source.name)}_prepared.csv`, { type: 'text/csv' });
      const res = await uploadDatasetFile(file);
      setSavedSig(signature(steps));
      setSyncedAt(new Date().toISOString());
      setNotice({ kind: 'success', text: res?.message || 'The working dataset is now the pipeline\'s active dataset.' });
      window.dispatchEvent(new Event('dataset-changed'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({
        kind: 'error',
        text: /fetch/i.test(msg) ? 'The backend is not reachable, so nothing was sent.' : `The pipeline rejected the dataset: ${msg}`,
      });
    } finally {
      setLoading(null);
    }
  }, [working, source, steps]);

  const runAuditNow = useCallback(async (experimentId = 'exp-baseline', comparisonId?: string) => {
    setAuditRunning(true);
    try {
      const res = await runAudit(experimentId, comparisonId);
      setAudit({ report: res.data, isReal: res.isReal });
      setBackendLive(res.isReal);
    } finally {
      setAuditRunning(false);
    }
  }, []);

  const rerunPipeline = useCallback(async () => {
    setReproducing(true);
    try {
      const proj = await fetchProject();
      setProject(proj);
      setBackendLive(proj.isReal);
      if (!proj.isReal) {
        setNotice({ kind: 'error', text: 'The backend is not reachable. The pipeline was not rerun and nothing was compared.' });
        return;
      }
      const res = await runFullPipelineExecution();
      if (res.status !== 'success') {
        setNotice({ kind: 'error', text: `The rerun failed at stage ${res.stage || '?'}: ${res.message || 'no message'}` });
        return;
      }
      setReproduction({
        at: new Date().toISOString(),
        runId: res.run_id,
        metrics: { accuracy: res.metrics?.accuracy, roc_auc: res.metrics?.roc_auc },
        baseline: { accuracy: proj.data.baseline_metrics.accuracy, roc_auc: proj.data.baseline_metrics.roc_auc },
        logs: res.logs,
      });
      await refreshBackend();
    } catch (err) {
      setNotice({ kind: 'error', text: `The rerun did not complete: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setReproducing(false);
    }
  }, [refreshBackend]);

  const findings = useMemo(
    () => buildWorkbenchFindings({ source, original, working, runs, workingSha, syncedAt, dirty, project, audit, reproduction }),
    [source, original, working, runs, workingSha, syncedAt, dirty, project, audit, reproduction]
  );

  const exportAudit = useCallback(() => {
    const doc = {
      generated_at: new Date().toISOString(),
      tool: 'ReproGuard',
      workspace_checks: { overall_status: overallStatus(findings), findings },
      backend_audit: audit
        ? audit.isReal
          ? { source: 'live backend', report: audit.report }
          : { source: 'DEMO DATA: the backend was offline, so this report is a built-in sample and not a check of the project', report: audit.report }
        : null,
      reproduction_attempt: reproduction,
      dataset: buildMetadata().original_dataset,
    };
    downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${stem(source?.name || 'reproguard')}_audit_report.json`);
  }, [findings, audit, reproduction, buildMetadata, source]);

  const value: Workbench = {
    source,
    original,
    working,
    steps,
    runs,
    loading,
    notice,
    setNotice,
    backendLive,
    project,
    importFile,
    loadFromPipeline,
    applyOp,
    deleteStep,
    toggleStep,
    moveStep,
    clearSteps,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    selectedStepId,
    setSelectedStepId,
    tab,
    setTab,
    trainAvailable: trainBlob !== null,
    viewTable,
    selection,
    setSelection,
    search,
    setSearch,
    searchOpen,
    setSearchOpen,
    dialog,
    openOp,
    closeDialog,
    qualityOpen,
    setQualityOpen,
    helpOpen,
    setHelpOpen,
    leftOpen,
    setLeftOpen,
    rightOpen,
    setRightOpen,
    workingSha,
    dirty,
    syncedAt,
    exportCsv,
    exportHistory,
    exportMetadata,
    exportAudit,
    buildMetadata,
    sendToPipeline,
    audit,
    auditRunning,
    runAuditNow,
    reproduction,
    reproducing,
    rerunPipeline,
    findings,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

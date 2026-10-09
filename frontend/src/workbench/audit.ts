// Checks the audit workspace derives from the actual workspace state.
// A check is NOT CHECKED whenever the information it needs was not available,
// so missing metadata is never reported as a pass or as a mismatch.

import type { AuditReport, AuditStatus, ProjectInfo } from '../types';
import type { Table } from './table';
import type { Reproduction, Source, StepRun } from './store';

export interface WorkbenchFinding {
  id: string;
  check: string;
  status: AuditStatus;
  found: string;
  evidence: string;
  why: string;
  action: string;
}

export interface AuditInputs {
  source: Source | null;
  original: Table | null;
  working: Table | null;
  runs: StepRun[];
  workingSha: string | null;
  syncedAt: string | null;
  dirty: boolean;
  project: { data: ProjectInfo; isReal: boolean } | null;
  audit: { report: AuditReport; isReal: boolean } | null;
  reproduction: Reproduction | null;
}

export const METRIC_TOLERANCE = 0.001;

const OFFLINE = 'The backend was not reachable, so this could not be read.';

export function buildWorkbenchFindings(x: AuditInputs): WorkbenchFinding[] {
  const out: WorkbenchFinding[] = [];
  const live = x.project?.isReal ? x.project.data : null;
  const liveAudit = x.audit?.isReal ? x.audit.report : null;
  const enabled = x.runs.filter(r => r.status !== 'disabled');
  const failed = x.runs.filter(r => r.status === 'error');
  const disabled = x.runs.filter(r => r.status === 'disabled');

  // 1. Fingerprint
  if (!x.source) {
    out.push({
      id: 'fingerprint',
      check: 'Dataset SHA-256 fingerprint',
      status: 'NOT CHECKED',
      found: 'No dataset is loaded.',
      evidence: '–',
      why: 'A fingerprint lets anyone confirm they hold byte-identical data.',
      action: 'Import a CSV or load the pipeline dataset.',
    });
  } else {
    out.push({
      id: 'fingerprint',
      check: 'Dataset SHA-256 fingerprint',
      status: 'PASS',
      found: 'A fingerprint was computed from the bytes of the original file.',
      evidence:
        `original ${x.source.sha256}` +
        (x.workingSha ? `\nworking (as exported CSV) ${x.workingSha}` : ''),
      why: 'A fingerprint lets anyone confirm they hold byte-identical data. A different fingerprint only means the contents differ; it does not by itself make an experiment invalid.',
      action: 'Keep this fingerprint with the experiment record. The pipeline backend records MD5 hashes, so the two are not compared here.',
    });
  }

  // 2. Dimensions
  if (!x.original || !x.working) {
    out.push({
      id: 'dimensions',
      check: 'Dataset dimensions',
      status: 'NOT CHECKED',
      found: 'No dataset is loaded.',
      evidence: '–',
      why: 'Row and column counts are the quickest way to notice a truncated or altered file.',
      action: 'Import a CSV or load the pipeline dataset.',
    });
  } else {
    // Once the working dataset has been sent, the registry describes that file, not the original.
    const recorded = x.source?.kind === 'pipeline' && !x.syncedAt ? live?.dataset_info?.row_count : undefined;
    const mismatch = recorded !== undefined && recorded !== x.original.nrows;
    out.push({
      id: 'dimensions',
      check: 'Dataset dimensions',
      status: mismatch ? 'WARNING' : 'PASS',
      found: mismatch
        ? `The backend registry records ${recorded!.toLocaleString()} rows, but the file parsed to ${x.original.nrows.toLocaleString()}.`
        : recorded !== undefined
          ? 'The parsed row count matches the count in the backend registry.'
          : 'Dimensions were measured. There is no recorded count to compare them with.',
      evidence:
        `original ${x.original.nrows.toLocaleString()} rows × ${x.original.columns.length} columns\n` +
        `working ${x.working.nrows.toLocaleString()} rows × ${x.working.columns.length} columns`,
      why: 'Row and column counts are the quickest way to notice a truncated or altered file.',
      action: mismatch ? 'Check for blank or malformed lines in the file.' : 'None.',
    });
  }

  // 3. Schema
  if (!x.working) {
    out.push({
      id: 'schema',
      check: 'Dataset schema',
      status: 'NOT CHECKED',
      found: 'No dataset is loaded.',
      evidence: '–',
      why: 'Column names and types define what the pipeline expects as input.',
      action: 'Import a CSV or load the pipeline dataset.',
    });
  } else {
    const empty = x.working.columns.filter(c => c.values.length > 0 && c.values.every(v => v === null));
    out.push({
      id: 'schema',
      check: 'Dataset schema',
      status: empty.length > 0 ? 'WARNING' : 'PASS',
      found:
        empty.length > 0
          ? `${empty.length} column(s) contain no values: ${empty.map(c => c.name).join(', ')}.`
          : `${x.working.columns.length} named columns with inferred types.`,
      evidence: x.working.columns.map(c => `${c.name}: ${c.type}`).join(', '),
      why: 'Column names and types define what the pipeline expects as input. Types are inferred from the values, not declared by the file.',
      action: empty.length > 0 ? 'Delete the empty columns or check the source file.' : 'None.',
    });
  }

  // 4. Recorded preprocessing steps
  const stepWhy = 'A preprocessing sequence that replays from the original file can be re-applied by someone else.';
  if (x.runs.length === 0) {
    out.push({
      id: 'steps',
      check: 'Recorded preprocessing steps',
      status: 'NOT CHECKED',
      found: 'No transformations have been applied in the workspace.',
      evidence: '–',
      why: stepWhy,
      action: 'None, unless preprocessing was done outside ReproGuard, in which case it is not recorded here.',
    });
  } else if (failed.length > 0) {
    out.push({
      id: 'steps',
      check: 'Recorded preprocessing steps',
      status: 'FAIL',
      found: `${failed.length} of ${x.runs.length} step(s) cannot be replayed from the original dataset.`,
      evidence: failed.map(r => `step ${r.index + 1} (${r.title}): ${r.error}`).join('\n'),
      why: stepWhy,
      action: 'Fix, reorder or delete the failing steps in Applied Steps.',
    });
  } else {
    out.push({
      id: 'steps',
      check: 'Recorded preprocessing steps',
      status: disabled.length > 0 ? 'WARNING' : 'PASS',
      found:
        `${enabled.length} step(s) replay from the original dataset without error.` +
        (disabled.length > 0 ? ` ${disabled.length} step(s) are disabled and excluded from the working dataset.` : ''),
      evidence: x.runs.map(r => `${r.index + 1}. ${r.title}${r.status === 'disabled' ? ' (disabled)' : ''}`).join('\n'),
      why: stepWhy,
      action: disabled.length > 0 ? 'Delete disabled steps or re-enable them so the record matches what was used.' : 'Export the transformation history with the experiment.',
    });
  }

  // 5. Transformation parameters
  if (enabled.length === 0) {
    out.push({
      id: 'parameters',
      check: 'Transformation parameters',
      status: 'NOT CHECKED',
      found: 'There are no active transformations to inspect.',
      evidence: '–',
      why: 'A step is only repeatable if its parameters and learned values are written down.',
      action: 'None.',
    });
  } else {
    out.push({
      id: 'parameters',
      check: 'Transformation parameters',
      status: 'PASS',
      found: `Parameters and learned values are recorded for all ${enabled.length} active step(s).`,
      evidence: enabled.map(r => `${r.step.id} ${r.step.op} ${JSON.stringify(r.step.params)}`).join('\n'),
      why: 'A step is only repeatable if its parameters and learned values are written down. Recording them does not prove the result is correct.',
      action: 'Export the transformation history as JSON to keep the specification.',
    });
  }

  // 6. Does the pipeline see the working dataset?
  const artifactWhy = 'Metrics describe whatever file the pipeline actually read. If that is not the working dataset, they describe different data.';
  if (!x.source) {
    out.push({
      id: 'pipeline-input',
      check: 'Pipeline input matches the working dataset',
      status: 'NOT CHECKED',
      found: 'No dataset is loaded.',
      evidence: '–',
      why: artifactWhy,
      action: 'Import a CSV or load the pipeline dataset.',
    });
  } else if (!live) {
    out.push({
      id: 'pipeline-input',
      check: 'Pipeline input matches the working dataset',
      status: 'NOT CHECKED',
      found: OFFLINE,
      evidence: '–',
      why: artifactWhy,
      action: 'Start the backend, then run the audit again.',
    });
  } else if (x.syncedAt && !x.dirty) {
    out.push({
      id: 'pipeline-input',
      check: 'Pipeline input matches the working dataset',
      status: 'PASS',
      found: 'The working dataset was sent to the pipeline vault and nothing has changed since.',
      evidence: `sent ${new Date(x.syncedAt).toLocaleString()}`,
      why: artifactWhy,
      action: 'None.',
    });
  } else if (x.source.kind === 'pipeline' && enabled.length === 0) {
    out.push({
      id: 'pipeline-input',
      check: 'Pipeline input matches the working dataset',
      status: 'PASS',
      found: 'The working dataset is the pipeline\'s active dataset as loaded, with no transformations.',
      evidence: `loaded ${new Date(x.source.loadedAt).toLocaleString()} from data/raw/wine.csv`,
      why: artifactWhy,
      action: 'None.',
    });
  } else {
    out.push({
      id: 'pipeline-input',
      check: 'Pipeline input matches the working dataset',
      status: 'WARNING',
      found:
        x.source.kind === 'upload' && !x.syncedAt
          ? 'This file was imported into the workspace and has not been sent to the pipeline.'
          : 'The working dataset has changes the pipeline has not received.',
      evidence: `${enabled.length} active step(s); last sent ${x.syncedAt ? new Date(x.syncedAt).toLocaleString() : 'never'}`,
      why: artifactWhy,
      action: 'Use File → Send working dataset to pipeline, then rerun.',
    });
  }

  // 7. Model configuration
  out.push(
    live
      ? {
          id: 'model',
          check: 'Model configuration',
          status: 'PASS',
          found: `${live.current_model} with parameters read from the repository.`,
          evidence: JSON.stringify(live.parameters),
          why: 'The model type and hyperparameters determine the result as much as the data does.',
          action: 'None.',
        }
      : {
          id: 'model',
          check: 'Model configuration',
          status: 'NOT CHECKED',
          found: OFFLINE,
          evidence: '–',
          why: 'The model type and hyperparameters determine the result as much as the data does.',
          action: 'Start the backend, then run the audit again.',
        }
  );

  // 8. Random seed
  const seed = live?.parameters?.split?.seed;
  out.push(
    !live
      ? {
          id: 'seed',
          check: 'Random seed',
          status: 'NOT CHECKED',
          found: OFFLINE,
          evidence: '–',
          why: 'Without a fixed seed, the train/test split and model training differ from run to run.',
          action: 'Start the backend, then run the audit again.',
        }
      : seed === undefined || seed === null
        ? {
            id: 'seed',
            check: 'Random seed',
            status: 'WARNING',
            found: 'No split.seed is recorded in the pipeline parameters.',
            evidence: JSON.stringify(live.parameters?.split ?? {}),
            why: 'Without a fixed seed, the train/test split and model training differ from run to run.',
            action: 'Set split.seed in params.yaml.',
          }
        : {
            id: 'seed',
            check: 'Random seed',
            status: 'PASS',
            found: 'A seed is recorded in the pipeline parameters.',
            evidence: `split.seed: ${seed}`,
            why: 'Without a fixed seed, the train/test split and model training differ from run to run. A recorded seed is necessary but not sufficient for identical results.',
            action: 'None.',
          }
  );

  // 9. Python version
  out.push(
    liveAudit
      ? {
          id: 'python',
          check: 'Python version',
          status: 'PASS',
          found: 'The backend reported its interpreter version during the audit.',
          evidence: `Python ${liveAudit.summary.python_version}`,
          why: 'Library behaviour can change between interpreter versions.',
          action: 'Record this version with the experiment.',
        }
      : {
          id: 'python',
          check: 'Python version',
          status: 'NOT CHECKED',
          found: x.audit ? OFFLINE : 'No backend audit has been run in this session.',
          evidence: '–',
          why: 'Library behaviour can change between interpreter versions.',
          action: 'Run the audit with the backend running.',
        }
  );

  // 10 & 11. Checks the backend performs
  const fromBackend = (id: string, check: string, match: RegExp, why: string) => {
    const f = liveAudit?.findings.find(b => match.test(b.category));
    out.push(
      f
        ? { id, check, status: f.status, found: f.explanation, evidence: f.evidence, why, action: f.action || 'None.' }
        : {
            id,
            check,
            status: 'NOT CHECKED',
            found: x.audit && !x.audit.isReal ? OFFLINE : 'No backend audit has been run in this session.',
            evidence: '–',
            why,
            action: 'Run the audit with the backend running.',
          }
    );
  };
  fromBackend('packages', 'Package versions', /environment/i, 'Unpinned packages can silently change numerical results.');
  fromBackend('artifacts', 'Input and output artifacts', /provenance/i, 'Hashes of stage inputs and outputs show whether each stage ran on what was recorded.');

  // 12. Recorded metrics
  const m = live?.last_recorded_metrics;
  out.push(
    live && m && m.accuracy !== undefined
      ? {
          id: 'metrics',
          check: 'Recorded evaluation metrics',
          status: 'PASS',
          found: 'Metrics are recorded in the repository. They were read, not re-computed.',
          evidence: `accuracy ${m.accuracy.toFixed(4)}` + (m.roc_auc !== undefined ? `, roc_auc ${m.roc_auc.toFixed(4)}` : ''),
          why: 'A recorded metric is the claim a reproduction attempt is compared against.',
          action: 'Rerun the pipeline to test the claim.',
        }
      : {
          id: 'metrics',
          check: 'Recorded evaluation metrics',
          status: 'NOT CHECKED',
          found: live ? 'The repository has no recorded metrics.' : OFFLINE,
          evidence: '–',
          why: 'A recorded metric is the claim a reproduction attempt is compared against.',
          action: live ? 'Run the pipeline once to record metrics.' : 'Start the backend, then run the audit again.',
        }
  );

  // 13. Reproduction attempt
  const reproWhy = 'Only an actual rerun shows whether the recorded result can be obtained again. Matching configuration alone does not.';
  if (!x.reproduction) {
    out.push({
      id: 'reproduction',
      check: 'Reproduction attempt',
      status: 'NOT CHECKED',
      found: 'The pipeline has not been rerun in this session.',
      evidence: '–',
      why: reproWhy,
      action: 'Use "Rerun pipeline and compare".',
    });
  } else {
    const r = x.reproduction;
    const dAcc = r.metrics.accuracy !== undefined ? r.metrics.accuracy - r.baseline.accuracy : NaN;
    const dRoc = r.metrics.roc_auc !== undefined ? r.metrics.roc_auc - r.baseline.roc_auc : NaN;
    const comparable = !isNaN(dAcc) && !isNaN(dRoc);
    const within = comparable && Math.abs(dAcc) <= METRIC_TOLERANCE && Math.abs(dRoc) <= METRIC_TOLERANCE;
    const signed = (d: number) => (d >= 0 ? '+' : '') + d.toFixed(4);
    out.push({
      id: 'reproduction',
      check: 'Reproduction attempt',
      status: !comparable ? 'WARNING' : within ? 'PASS' : 'WARNING',
      found: !comparable
        ? 'The pipeline was rerun, but it did not return both metrics, so the result could not be compared.'
        : within
          ? `The rerun matched the documented baseline within ±${METRIC_TOLERANCE}.`
          : 'The rerun produced different metrics from the documented baseline.',
      evidence:
        `rerun ${new Date(r.at).toLocaleString()}${r.runId ? ` (${r.runId})` : ''}\n` +
        `accuracy ${r.metrics.accuracy?.toFixed(4) ?? '–'} vs baseline ${r.baseline.accuracy.toFixed(4)}${comparable ? ` (${signed(dAcc)})` : ''}\n` +
        `roc_auc ${r.metrics.roc_auc?.toFixed(4) ?? '–'} vs baseline ${r.baseline.roc_auc.toFixed(4)}${comparable ? ` (${signed(dRoc)})` : ''}`,
      why: reproWhy,
      action: within
        ? 'None.'
        : 'If the pipeline ran on a different dataset than the baseline, a difference is expected. Otherwise compare seeds, package versions and data fingerprints.',
    });
  }

  return out;
}

export function overallStatus(findings: { status: AuditStatus }[]): AuditStatus {
  if (findings.some(f => f.status === 'FAIL')) return 'FAIL';
  if (findings.some(f => f.status === 'WARNING')) return 'WARNING';
  if (findings.some(f => f.status === 'PASS')) return 'PASS';
  return 'NOT CHECKED';
}

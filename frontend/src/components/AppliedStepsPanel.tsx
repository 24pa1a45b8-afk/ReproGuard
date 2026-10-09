import { useEffect, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronRight, CircleSlash, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useWorkbench } from '../workbench/store';
import type { StepRun } from '../workbench/store';
import { OP_BY_ID } from '../workbench/ops';
import type { ChangeKind } from '../workbench/ops';
import { cellCount, fingerprintTable, schemaOf } from '../workbench/table';
import { KV, Tag } from './ui';

const changeTone: Record<ChangeKind, 'green' | 'blue' | 'red' | 'grey'> = {
  added: 'green',
  modified: 'blue',
  renamed: 'blue',
  moved: 'grey',
  removed: 'red',
};

function StepMetadata({ run }: { run: StepRun }) {
  const [prints, setPrints] = useState<{ input: string; output: string } | null>(null);
  const large = cellCount(run.input) > 3_000_000;

  useEffect(() => {
    setPrints(null);
    if (large || run.status !== 'ok') return;
    let stale = false;
    Promise.all([fingerprintTable(run.input), fingerprintTable(run.output)]).then(([input, output]) => {
      if (!stale) setPrints({ input, output });
    });
    return () => {
      stale = true;
    };
  }, [run, large]);

  const meta = {
    step_id: run.step.id,
    operation: run.step.op,
    columns: OP_BY_ID[run.step.op]?.columnsOf(run.step.params) ?? [],
    parameters: run.step.params,
    applied_at: run.step.appliedAt,
    input_schema: schemaOf(run.input),
    output_schema: schemaOf(run.output),
    input_fingerprint: prints?.input ?? (large ? 'not computed (large dataset)' : run.status === 'ok' ? 'computing…' : null),
    output_fingerprint: prints?.output ?? (large ? 'not computed (large dataset)' : run.status === 'ok' ? 'computing…' : null),
  };

  return (
    <pre className="mt-1 p-2 max-h-56 overflow-auto rounded bg-background border border-border text-[11px] leading-snug text-muted font-mono whitespace-pre-wrap break-all">
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}

function StepDetails({ run }: { run: StepRun }) {
  const [showMeta, setShowMeta] = useState(false);
  const def = OP_BY_ID[run.step.op];
  const columns = def?.columnsOf(run.step.params) ?? [];
  const learned = Object.entries(run.learned);

  return (
    <div className="mt-2 pl-[26px] pr-1 pb-1 space-y-2.5" onClick={e => e.stopPropagation()}>
      {run.status === 'error' && (
        <p role="alert" className="text-xs text-error">
          This step cannot be applied at this position: {run.error} It is skipped, and later steps run on the data without it.
        </p>
      )}
      {run.status === 'disabled' && (
        <p className="text-xs text-muted">Disabled. This step is excluded from the working dataset and from exports.</p>
      )}

      <dl>
        <div className="caps !text-[10px] mb-0.5">Step details</div>
        <KV k="operation">{def?.label ?? run.step.op}</KV>
        {columns.length > 0 && <KV k="columns affected">{columns.join(', ')}</KV>}
        {run.status === 'ok' && (
          <>
            <KV k="rows affected">{run.rowsAffected.toLocaleString()}</KV>
            <KV k="rows">
              {run.input.nrows === run.output.nrows
                ? run.output.nrows.toLocaleString()
                : `${run.input.nrows.toLocaleString()} → ${run.output.nrows.toLocaleString()}`}
            </KV>
          </>
        )}
        <KV k="applied at">{new Date(run.step.appliedAt).toLocaleString()}</KV>
      </dl>

      {learned.length > 0 && (
        <dl>
          <div className="caps !text-[10px] mb-0.5">Learned</div>
          {learned.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 text-xs py-0.5">
              <dt className="text-muted shrink-0">{k}</dt>
              <dd className="text-text text-right truncate" title={v}>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {run.changed.length > 0 && (
        <div>
          <div className="caps !text-[10px] mb-1">Changed</div>
          <ul className="space-y-1">
            {run.changed.map(ch => (
              <li key={`${ch.column}:${ch.change}`} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted truncate" title={ch.column}>{ch.column}</span>
                <Tag tone={changeTone[ch.change]}>{ch.change}</Tag>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowMeta(!showMeta)}
          aria-expanded={showMeta}
          className="flex items-center gap-1 caps !text-[10px] hover:text-text cursor-pointer"
        >
          {showMeta ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Metadata
        </button>
        {showMeta && <StepMetadata run={run} />}
      </div>
    </div>
  );
}

export default function AppliedStepsPanel() {
  const { runs, source, selectedStepId, setSelectedStepId, deleteStep, toggleStep, moveStep } = useWorkbench();

  return (
    <div className="h-full flex flex-col bg-panel min-w-0">
      <div className="h-9 px-3.5 flex items-center justify-between border-b border-border shrink-0">
        <span className="caps">Applied steps</span>
        <span className="text-[11px] font-medium text-muted bg-raised rounded px-1.5 py-px">{runs.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {runs.length === 0 ? (
          <p className="px-2 py-2 text-xs leading-relaxed text-muted">
            {source
              ? 'Every change you make is recorded here as a step, in order. Reorder or disable any of them at any time. The original file is never modified.'
              : 'Load a dataset to start. Each transformation you apply will be recorded here as a step.'}
          </p>
        ) : (
          <ol className="space-y-0.5">
            {runs.map((run, i) => {
              const selected = run.step.id === selectedStepId;
              return (
                <li
                  key={run.step.id}
                  className={`group rounded-md border px-2 py-1.5 cursor-pointer ${
                    selected ? 'bg-raised border-border' : 'border-transparent hover:bg-raised/60'
                  }`}
                  onClick={() => setSelectedStepId(selected ? null : run.step.id)}
                >
                  <div className="flex items-center gap-2 min-h-6">
                    {run.status === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-label="Applied" />
                    ) : run.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-error shrink-0" aria-label="Failed" />
                    ) : (
                      <CircleSlash className="w-4 h-4 text-muted shrink-0" aria-label="Disabled" />
                    )}
                    <span className="text-xs text-muted tabular-nums w-4 shrink-0">{i + 1}</span>
                    <button
                      type="button"
                      aria-expanded={selected}
                      title={run.title}
                      className={`flex-1 min-w-0 text-left text-[13px] truncate cursor-pointer ${
                        run.status === 'disabled' ? 'text-muted line-through' : 'text-text'
                      }`}
                    >
                      {run.title}
                    </button>
                    <span
                      className={`items-center shrink-0 ${selected ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <button type="button" className="tool !w-6 !h-6" disabled={i === 0} onClick={() => moveStep(run.step.id, -1)} title="Move earlier" aria-label="Move step earlier">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" className="tool !w-6 !h-6" disabled={i === runs.length - 1} onClick={() => moveStep(run.step.id, 1)} title="Move later" aria-label="Move step later">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="tool !w-6 !h-6"
                        onClick={() => toggleStep(run.step.id)}
                        title={run.step.enabled ? 'Disable step' : 'Enable step'}
                        aria-label={run.step.enabled ? 'Disable step' : 'Enable step'}
                      >
                        {run.step.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button type="button" className="tool !w-6 !h-6" onClick={() => deleteStep(run.step.id)} title="Delete step" aria-label="Delete step">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                  {selected && <StepDetails run={run} />}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

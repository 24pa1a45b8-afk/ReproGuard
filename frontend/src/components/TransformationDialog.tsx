import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useWorkbench } from '../workbench/store';
import { OP_BY_ID } from '../workbench/ops';
import type { Field, Params } from '../workbench/ops';
import { TYPE_GLYPH } from './DataGrid';
import { Modal } from './Menu';
import { Btn } from './ui';

export default function TransformationDialog() {
  const { dialog, closeDialog, working, viewTable, selection, applyOp } = useWorkbench();
  const def = dialog ? OP_BY_ID[dialog.opId] : undefined;

  const initial = useMemo<Params>(() => {
    if (!def || !working) return {};
    const selected = selection && viewTable === working ? working.columns[selection.col] : undefined;
    return { ...def.defaults(working, selected), ...(dialog?.params || {}) };
  }, [def, working, viewTable, selection, dialog]);

  const [edits, setEdits] = useState<Params>({});
  const [error, setError] = useState<string | null>(null);

  if (!dialog || !def || !working) return null;

  const params: Params = { ...initial, ...edits };
  const set = (key: string, value: unknown) => {
    setError(null);
    setEdits(e => ({ ...e, [key]: value }));
  };

  // A select whose current value is no longer offered falls back to the first option.
  for (const f of def.fields) {
    if (f.kind === 'select' && f.options) {
      const opts = f.options(working, params);
      if (opts.length > 0 && !opts.some(o => o.value === params[f.key])) params[f.key] = opts[0].value;
    }
  }

  const submit = () => {
    const err = applyOp(def.id, params);
    if (err) setError(err);
    else closeDialog();
  };

  const renderField = (f: Field) => {
    if (f.showIf && !f.showIf(params)) return null;
    const id = `tf-${f.key}`;
    const eligible = working.columns.filter(c => !f.accept || f.accept.includes(c.type));

    let control;
    if (f.kind === 'column') {
      control = eligible.length === 0 ? (
        <p className="text-xs text-warning">No {f.accept?.join(' or ')} columns in the working dataset.</p>
      ) : (
        <select id={id} className="field" value={params[f.key] || ''} onChange={e => set(f.key, e.target.value)}>
          <option value="" disabled>Choose a column…</option>
          {eligible.map(c => (
            <option key={c.name} value={c.name}>{TYPE_GLYPH[c.type]}  {c.name}</option>
          ))}
        </select>
      );
    } else if (f.kind === 'columns') {
      const choices = f.options
        ? f.options(working, params)
        : eligible.map(c => ({ value: c.name, label: `${TYPE_GLYPH[c.type]}  ${c.name}` }));
      const chosen: string[] = params[f.key] || [];
      const toggle = (v: string) => set(f.key, chosen.includes(v) ? chosen.filter(x => x !== v) : [...chosen, v]);
      control = choices.length === 0 ? (
        <p className="text-xs text-warning">No {f.accept?.join(' or ')} columns in the working dataset.</p>
      ) : (
        <div>
          <div className="max-h-40 overflow-y-auto border border-border rounded-[5px] bg-background py-1">
            {choices.map(o => (
              <label key={o.value} className="flex items-center gap-2 px-2 h-6 text-xs text-text hover:bg-raised cursor-pointer">
                <input type="checkbox" className="accent-primary" checked={chosen.includes(o.value)} onChange={() => toggle(o.value)} />
                <span className="truncate whitespace-pre">{o.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
            <span>{chosen.length === 0 && f.emptyMeans ? `None selected: ${f.emptyMeans}` : `${chosen.length} selected`}</span>
            <span className="space-x-2">
              <button type="button" className="hover:text-text cursor-pointer" onClick={() => set(f.key, choices.map(o => o.value))}>All</button>
              <button type="button" className="hover:text-text cursor-pointer" onClick={() => set(f.key, [])}>None</button>
            </span>
          </div>
        </div>
      );
    } else if (f.kind === 'select') {
      const opts = f.options ? f.options(working, params) : [];
      control = (
        <select id={id} className="field" value={params[f.key]} onChange={e => set(f.key, e.target.value)}>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else if (f.kind === 'toggle') {
      return (
        <div key={f.key}>
          <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
            <input type="checkbox" className="accent-primary" checked={!!params[f.key]} onChange={e => set(f.key, e.target.checked)} />
            {f.label}
          </label>
          {f.help && <p className="mt-1 text-[11px] text-muted">{f.help}</p>}
        </div>
      );
    } else {
      control = (
        <input
          id={id}
          className="field"
          type={f.kind === 'number' ? 'number' : 'text'}
          value={params[f.key] ?? ''}
          onChange={e => set(f.key, e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit();
          }}
        />
      );
    }

    return (
      <div key={f.key}>
        <label htmlFor={id} className="block text-xs text-muted mb-1">{f.label}</label>
        {control}
        {f.help && <p className="mt-1 text-[11px] text-muted">{f.help}</p>}
      </div>
    );
  };

  return (
    <Modal
      title={def.label}
      onClose={closeDialog}
      footer={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn variant="primary" onClick={submit}>Apply</Btn>
        </>
      }
    >
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted">{def.effect}</p>
        {def.fields.map(renderField)}
        {def.destructive && (
          <p className="flex items-start gap-2 text-[11px] text-warning">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>This removes data from the working dataset. The original file is not changed, and the step can be undone, disabled or deleted.</span>
          </p>
        )}
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
      </div>
    </Modal>
  );
}

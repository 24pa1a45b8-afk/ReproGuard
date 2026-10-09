import { useMemo } from 'react';
import { useWorkbench } from '../workbench/store';
import { datasetQuality } from '../workbench/stats';
import { Modal } from './Menu';
import { Btn, Tag, Th } from './ui';

export function QualityDialog() {
  const { working, setQualityOpen, source } = useWorkbench();
  const q = useMemo(() => (working ? datasetQuality(working) : null), [working]);
  if (!working || !q) return null;
  const close = () => setQualityOpen(false);

  return (
    <Modal title={`Data quality: ${source?.name ?? 'working dataset'}`} onClose={close} width="max-w-4xl" footer={<Btn variant="primary" onClick={close}>Done</Btn>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border">
        {[
          ['Rows', q.rows.toLocaleString()],
          ['Columns', q.columns.toLocaleString()],
          ['Duplicate rows', q.duplicateRows.toLocaleString()],
          ['Missing cells', q.cellsMissing.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3 border-r border-border last:border-r-0">
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-0.5 text-[15px] font-medium tabular-nums">{value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="sheet">
          <thead>
            <tr>
              <th className="rn"></th>
              <Th>column</Th>
              <Th>type</Th>
              <Th t="#" className="num">missing</Th>
              <Th t="#" className="num">unique</Th>
              <Th>flags</Th>
            </tr>
          </thead>
          <tbody>
            {q.perColumn.map((s, i) => (
              <tr key={s.name}>
                <td className="rn">{i + 1}</td>
                <td className="font-medium">{s.name}</td>
                <td className="text-muted">{s.type}</td>
                <td className="num">
                  {s.missing.toLocaleString()}
                  {s.missing > 0 && <span className="text-muted"> · {((s.missing / Math.max(1, s.total)) * 100).toFixed(1)}%</span>}
                </td>
                <td className="num">{s.unique.toLocaleString()}</td>
                <td>
                  <span className="flex items-center gap-1.5">
                    {s.total > 0 && s.missing === s.total && <Tag tone="amber">empty</Tag>}
                    {s.constant && <Tag tone="amber">constant</Tag>}
                    {s.identifierLike && <Tag tone="grey">identifier</Tag>}
                    {s.numeric && !s.identifierLike && s.numeric.outliers > 0 && <Tag tone="grey">{s.numeric.outliers.toLocaleString()} potential outliers</Tag>}
                    {s.missing === 0 && !s.constant && <Tag tone="green">complete</Tag>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-xs text-muted">
        Types are inferred from the values. Potential outliers are values more than 1.5 × IQR outside the middle half; they are a prompt to look, not errors.
      </p>
    </Modal>
  );
}

export function HelpDialog() {
  const { setHelpOpen } = useWorkbench();
  const close = () => setHelpOpen(false);
  const keys: [string, string][] = [
    ['Arrow keys', 'Move the active cell'],
    ['Page Up / Page Down', 'Move one screen'],
    ['Home / End', 'First / last column'],
    ['Ctrl+Home / Ctrl+End', 'First / last row'],
    ['Ctrl+Z', 'Undo the last step change'],
    ['Ctrl+Y or Ctrl+Shift+Z', 'Redo'],
    ['Esc', 'Close a menu, dialog or search'],
  ];
  return (
    <Modal title="About ReproGuard" onClose={close} footer={<Btn variant="primary" onClick={close}>Close</Btn>}>
      <div className="p-4 space-y-3 text-xs text-muted leading-relaxed">
        <p className="text-text text-[13px]">Trust every experiment. Reproduce every result.</p>
        <p>
          The workspace keeps the file you loaded untouched and records every transformation as a step. The working dataset is always the original with the enabled steps replayed in order, so steps can be undone, disabled, reordered or deleted.
        </p>
        <p>
          Transformations run in this browser. Use File → Send working dataset to pipeline to make the result the pipeline's active dataset, then rerun the pipeline from the Audit menu.
        </p>
        <table className="sheet !text-xs">
          <tbody>
            {keys.map(([k, v]) => (
              <tr key={k}>
                <td className="text-text">{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

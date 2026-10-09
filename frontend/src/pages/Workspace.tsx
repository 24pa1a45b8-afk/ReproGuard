import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { FileUp, RefreshCw } from 'lucide-react';
import AppliedStepsPanel from '../components/AppliedStepsPanel';
import ColumnInspector from '../components/ColumnInspector';
import DataGrid from '../components/DataGrid';
import Toolbar from '../components/Toolbar';
import TransformationDialog from '../components/TransformationDialog';
import { QualityDialog } from '../components/WorkspaceDialogs';
import { Btn, Th } from '../components/ui';
import { useWorkbench } from '../workbench/store';
import type { Table } from '../workbench/table';

function searchRows(table: Table, query: string): Int32Array | null {
  const q = query.trim().toLowerCase();
  if (q === '') return null;
  const cols = table.columns.map(c => c.values);
  const hits: number[] = [];
  for (let r = 0; r < table.nrows; r++) {
    for (let c = 0; c < cols.length; c++) {
      const v = cols[c][r];
      if (v !== null && v.toLowerCase().includes(q)) {
        hits.push(r);
        break;
      }
    }
  }
  return Int32Array.from(hits);
}

/** Drag handle between a side panel and the grid. */
function Resizer({ onDrag, label }: { onDrag: (dx: number) => void; label: string }) {
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    let last = e.clientX;
    const move = (ev: PointerEvent) => {
      onDrag(ev.clientX - last);
      last = ev.clientX;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={start}
      className="w-px shrink-0 bg-border relative cursor-col-resize after:absolute after:inset-y-0 after:-left-[3px] after:w-[7px] hover:bg-primary"
    />
  );
}

function flatten(value: unknown, path: string, out: [string, string][]) {
  if (value === null || value === undefined) out.push([path, '–']);
  else if (Array.isArray(value)) {
    if (value.length === 0) out.push([path, 'none']);
    else if (value.every(v => v && typeof v === 'object' && 'name' in v && 'type' in v)) {
      out.push([path, (value as { name: string; type: string }[]).map(v => `${v.name}: ${v.type}`).join(', ')]);
    } else value.forEach((v, i) => flatten(v, `${path}[${i + 1}]`, out));
  } else if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (path.endsWith('parameters') || path.endsWith('.metrics') || path.endsWith('baseline')) out.push([path, JSON.stringify(value)]);
    else entries.forEach(([k, v]) => flatten(v, path ? `${path}.${k}` : k, out));
  } else out.push([path, String(value)]);
}

function MetadataView() {
  const { buildMetadata, exportMetadata } = useWorkbench();
  const rows = useMemo(() => {
    const out: [string, string][] = [];
    flatten(buildMetadata(), '', out);
    return out;
  }, [buildMetadata]);

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="h-9 px-4 flex items-center justify-between gap-3 bg-background border-b border-border">
        <span className="caps">Experiment metadata</span>
        <Btn onClick={() => void exportMetadata()}>Download .json</Btn>
      </div>
      <table className="sheet">
        <thead>
          <tr>
            <th className="rn"></th>
            <Th>field</Th>
            <Th>value</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={k}>
              <td className="rn">{i + 1}</td>
              <td className="text-muted">{k}</td>
              <td className="wrap break-all">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Workspace() {
  const wb = useWorkbench();
  const [leftW, setLeftW] = useState(310);
  const [rightW, setRightW] = useState(320);
  const fileInput = useRef<HTMLInputElement>(null);

  const table = wb.viewTable;
  const query = useDeferredValue(wb.search);
  const rowMap = useMemo(() => (table ? searchRows(table, query) : null), [table, query]);

  const sel = table && wb.selection && wb.selection.col < table.columns.length ? wb.selection : null;
  const safeSel =
    sel && sel.row !== null && sel.row >= (rowMap ? rowMap.length : table!.nrows) ? { row: null, col: sel.col } : sel;
  const column = table && safeSel ? table.columns[safeSel.col] : null;

  const clamp = (w: number) => Math.max(240, Math.min(480, w));
  const editable = wb.tab === 'working';

  let center;
  if (wb.loading && !table) {
    center = (
      <div className="h-full flex items-center justify-center gap-2 text-muted">
        <RefreshCw className="w-4 h-4 animate-spin" /> {wb.loading}
      </div>
    );
  } else if (wb.tab === 'metadata' && wb.original) {
    center = <MetadataView />;
  } else if (!table) {
    center = (
      <div
        className="h-full flex flex-col items-center justify-center gap-3 text-center px-6"
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void wb.importFile(f);
        }}
      >
        <FileUp className="w-7 h-7 text-muted" />
        <div className="text-[15px] font-medium text-text">
          {wb.tab === 'train' ? 'Reading the train split…' : 'No dataset loaded'}
        </div>
        {wb.tab !== 'train' && (
          <>
            <p className="max-w-sm text-xs text-muted leading-relaxed">
              Import a CSV file, or drop one here.
              {wb.backendLive === false && ' The pipeline backend is offline, so its dataset could not be loaded automatically.'}
            </p>
            <div className="flex items-center gap-2">
              <Btn variant="primary" onClick={() => fileInput.current?.click()}>Import CSV…</Btn>
              <Btn onClick={() => void wb.loadFromPipeline(true)}>Load pipeline dataset</Btn>
            </div>
          </>
        )}
      </div>
    );
  } else if (table.columns.length === 0) {
    center = <div className="h-full flex items-center justify-center text-muted">This dataset has no columns.</div>;
  } else {
    center = (
      <div className="h-full relative">
        <DataGrid
          table={table}
          rowMap={rowMap}
          selection={safeSel}
          onSelect={wb.setSelection}
          onFilterColumn={editable ? name => wb.openOp('filter_rows', { column: name }) : undefined}
        />
        {(rowMap ? rowMap.length : table.nrows) === 0 && (
          <div className="absolute inset-x-0 top-24 text-center text-xs text-muted pointer-events-none">
            {rowMap ? 'No rows contain the search text.' : 'No rows. The header is shown above.'}
          </div>
        )}
        {wb.loading && (
          <div className="absolute top-3 right-3 flex items-center gap-2 px-3 h-8 rounded-md bg-raised border border-border text-xs text-text">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {wb.loading}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void wb.importFile(f);
        }}
      />
      <Toolbar rowMap={rowMap} />

      <div className="flex-1 flex min-h-0 min-w-0">
        {wb.leftOpen && (
          <>
            <div className="shrink-0 max-w-[80vw]" style={{ width: leftW }}>
              <AppliedStepsPanel />
            </div>
            <Resizer label="Resize applied steps panel" onDrag={dx => setLeftW(w => clamp(w + dx))} />
          </>
        )}

        <div className="flex-1 min-w-0 min-h-0">{center}</div>

        {wb.rightOpen && (
          <>
            <Resizer label="Resize column inspector" onDrag={dx => setRightW(w => clamp(w - dx))} />
            <div className="shrink-0 max-w-[80vw]" style={{ width: rightW }}>
              <ColumnInspector column={column} onClose={() => wb.setRightOpen(false)} />
            </div>
          </>
        )}
      </div>

      {wb.dialog && <TransformationDialog key={wb.dialog.opId + JSON.stringify(wb.dialog.params ?? {})} />}
      {wb.qualityOpen && <QualityDialog />}
    </div>
  );
}

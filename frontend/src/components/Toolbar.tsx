import { useRef } from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ClipboardCheck,
  PaintBucket,
  FileDown,
  FileUp,
  Filter,
  PanelLeft,
  PanelRight,
  Redo2,
  Search,
  Sigma,
  Trash2,
  Type,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useWorkbench } from '../workbench/store';
import { colLetter } from '../workbench/table';
import { TYPE_GLYPH } from './DataGrid';

function Tool({
  label,
  onClick,
  disabled,
  on,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  on?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" className={`tool ${on ? 'is-on' : ''}`} title={label} aria-label={label} aria-pressed={on} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

const Sep = () => <span className="w-px h-5 bg-border mx-1.5 shrink-0" />;

export default function Toolbar({ rowMap }: { rowMap: Int32Array | null }) {
  const wb = useWorkbench();
  const fileInput = useRef<HTMLInputElement>(null);

  const table = wb.viewTable;
  const editable = !!wb.working && wb.tab === 'working';
  const sel = table && wb.selection && wb.selection.col < table.columns.length ? wb.selection : null;
  const column = sel && table ? table.columns[sel.col] : undefined;
  const editColumn = editable ? column : undefined;

  const numericOrOther = () => {
    if (!editColumn) return;
    if (editColumn.type === 'number') wb.openOp('numeric_transform');
    else if (editColumn.type === 'date') wb.openOp('extract_datetime');
    else wb.openOp('one_hot');
  };

  const sort = (direction: 'asc' | 'desc') => {
    if (!editColumn) return;
    const err = wb.applyOp('sort_rows', { column: editColumn.name, direction });
    if (err) wb.setNotice({ kind: 'error', text: err });
  };

  // Formula-bar values
  let address = '';
  let value = '';
  if (sel && table) {
    if (sel.row === null) {
      address = `${colLetter(sel.col)}:${colLetter(sel.col)}`;
      value = `${table.nrows.toLocaleString()} cells selected`;
    } else {
      const r = rowMap ? rowMap[sel.row] : sel.row;
      address = `${colLetter(sel.col)}${r + 1}`;
      const v = column!.values[r];
      value = v === null ? '' : v;
    }
  }
  const isMissing = !!sel && sel.row !== null && value === '';

  return (
    <div className="shrink-0 bg-surface border-b border-border">
      <div className="h-10 px-2.5 flex items-center overflow-x-auto">
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
        <Tool label="Import dataset (CSV)" onClick={() => fileInput.current?.click()}><FileUp className="w-4 h-4" /></Tool>
        <Tool label="Export working dataset (CSV)" onClick={wb.exportCsv} disabled={!wb.working}><FileDown className="w-4 h-4" /></Tool>
        <Sep />
        <Tool label="Undo (Ctrl+Z)" onClick={wb.undo} disabled={!wb.canUndo}><Undo2 className="w-4 h-4" /></Tool>
        <Tool label="Redo (Ctrl+Y)" onClick={wb.redo} disabled={!wb.canRedo}><Redo2 className="w-4 h-4" /></Tool>
        <Sep />
        <Tool label="Delete selected column" onClick={() => wb.openOp('delete_column')} disabled={!editColumn}><Trash2 className="w-4 h-4" /></Tool>
        <Tool
          label="Sort ascending by selected column"
          onClick={() => sort('asc')}
          disabled={!editColumn}
        >
          <ArrowUpAZ className="w-4 h-4" />
        </Tool>
        <Tool
          label="Sort descending by selected column"
          onClick={() => sort('desc')}
          disabled={!editColumn}
        >
          <ArrowDownAZ className="w-4 h-4" />
        </Tool>
        <Tool label="Filter rows" onClick={() => wb.openOp('filter_rows')} disabled={!editable}><Filter className="w-4 h-4" /></Tool>
        <Tool label="Search in the table" onClick={() => wb.setSearchOpen(!wb.searchOpen)} disabled={!table} on={wb.searchOpen}><Search className="w-4 h-4" /></Tool>
        <Sep />
        <Tool label="Transform selected column" onClick={numericOrOther} disabled={!editColumn}><Wand2 className="w-4 h-4" /></Tool>
        <Tool label="Fill missing values" onClick={() => wb.openOp('fill_missing')} disabled={!editable}><PaintBucket className="w-4 h-4" /></Tool>
        <Tool label="Summary statistics for selected column" onClick={() => wb.setRightOpen(true)} disabled={!column}><Sigma className="w-4 h-4" /></Tool>
        <Tool label="Inspect or change column type" onClick={() => wb.openOp('change_type')} disabled={!editColumn}><Type className="w-4 h-4" /></Tool>
        <Sep />
        <Tool label="Data quality report" onClick={() => wb.setQualityOpen(true)} disabled={!wb.working}><ClipboardCheck className="w-4 h-4" /></Tool>

        {wb.searchOpen && (
          <div className="ml-3 flex items-center gap-1 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                type="search"
                aria-label="Search in the table"
                placeholder="Find rows containing…"
                value={wb.search}
                onChange={e => wb.setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    wb.setSearch('');
                    wb.setSearchOpen(false);
                  }
                }}
                className="field !w-56 !pl-7"
              />
            </div>
            {wb.search && rowMap && (
              <span className="text-xs text-muted tabular-nums whitespace-nowrap">
                {rowMap.length.toLocaleString()} of {table?.nrows.toLocaleString()} rows
              </span>
            )}
            <button
              type="button"
              className="tool !w-6 !h-6"
              title="Close search"
              aria-label="Close search"
              onClick={() => {
                wb.setSearch('');
                wb.setSearchOpen(false);
              }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <span className="ml-auto pl-4 text-xs text-muted whitespace-nowrap hidden xl:block">
          {wb.tab === 'working' ? 'Every change is recorded as a step' : 'Read-only view'}
        </span>
        <span className="ml-3 flex items-center shrink-0">
          <Tool label={wb.leftOpen ? 'Hide applied steps' : 'Show applied steps'} onClick={() => wb.setLeftOpen(!wb.leftOpen)} on={wb.leftOpen}>
            <PanelLeft className="w-4 h-4" />
          </Tool>
          <Tool label={wb.rightOpen ? 'Hide column inspector' : 'Show column inspector'} onClick={() => wb.setRightOpen(!wb.rightOpen)} on={wb.rightOpen}>
            <PanelRight className="w-4 h-4" />
          </Tool>
        </span>
      </div>

      {/* Formula bar: cell address, value, column type */}
      <div className="h-9 px-2.5 flex items-center gap-2 border-t border-border">
        <div className="field !w-28 flex items-center tabular-nums shrink-0" aria-label="Cell address">{address}</div>
        <Sigma className="w-3.5 h-3.5 text-muted shrink-0" />
        <div className="flex-1 min-w-0 text-[13px] text-text truncate" aria-label="Cell value" title={value}>
          {isMissing ? <span className="italic text-muted">missing value</span> : value}
        </div>
        {column && (
          <div className="flex items-center gap-2 text-xs text-muted shrink-0">
            <span className="truncate max-w-[220px]" title={column.name}>{column.name}</span>
            <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-raised text-[11px]">
              <span className="text-text">{TYPE_GLYPH[column.type]}</span>
              {column.type}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Filter } from 'lucide-react';
import type { ColType, Table } from '../workbench/table';
import { colLetter } from '../workbench/table';
import { missingCount } from '../workbench/stats';
import type { Selection } from '../workbench/store';

const ROW_H = 28;
const LETTER_H = 22;
const NAME_H = 34;
const HEAD_H = LETTER_H + NAME_H;
const MIN_COL = 70;
// Browsers cap element height; beyond this the scrollbar maps proportionally onto the rows.
const MAX_SCROLL_H = 10_000_000;

export const TYPE_GLYPH: Record<ColType, string> = { number: '#', text: 'T', date: 'D' };

function defaultWidth(name: string, type: ColType): number {
  return Math.max(type === 'date' ? 190 : 120, Math.min(280, name.length * 8 + 76));
}

interface Props {
  table: Table;
  /** Optional row subset (search results), as indexes into the table. */
  rowMap: Int32Array | null;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  /** Shown as a small control in each header; omitted for read-only views. */
  onFilterColumn?: (column: string) => void;
}

/**
 * Virtualised grid: only the cells inside the viewport exist in the DOM, so
 * the row and column counts do not affect rendering cost.
 */
export default function DataGrid({ table, rowMap, selection, onSelect, onFilterColumn }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [widths, setWidths] = useState<Record<string, number>>({});
  const frame = useRef(0);

  const nrows = rowMap ? rowMap.length : table.nrows;
  // Wide enough for the largest row number with its thousands separators.
  const GUTTER = Math.max(48, table.nrows.toLocaleString().length * 8 + 22);
  const ncols = table.columns.length;

  const { lefts, totalW } = useMemo(() => {
    const l = new Array<number>(ncols + 1);
    let x = 0;
    for (let c = 0; c < ncols; c++) {
      l[c] = x;
      x += widths[table.columns[c].name] ?? defaultWidth(table.columns[c].name, table.columns[c].type);
    }
    l[ncols] = x;
    return { lefts: l, totalW: x };
  }, [table.columns, widths, ncols]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) setScroll({ top: el.scrollTop, left: el.scrollLeft });
    });
  };

  const bodyH = Math.max(0, view.h - HEAD_H);
  const totalH = nrows * ROW_H;
  const scrollH = Math.min(totalH, MAX_SCROLL_H);
  const maxScroll = Math.max(0, scrollH - bodyH);
  const realMax = Math.max(0, totalH - bodyH);
  const realTop = maxScroll > 0 ? Math.min(realMax, scroll.top * (realMax / maxScroll)) : 0;
  const firstRow = Math.floor(realTop / ROW_H);
  const offsetY = realTop - firstRow * ROW_H;
  const rowCount = Math.min(nrows - firstRow, Math.ceil(bodyH / ROW_H) + 1);

  const bodyW = Math.max(0, view.w - GUTTER);
  let firstCol = 0;
  while (firstCol < ncols - 1 && lefts[firstCol + 1] <= scroll.left) firstCol++;
  let lastCol = firstCol;
  while (lastCol < ncols - 1 && lefts[lastCol + 1] < scroll.left + bodyW) lastCol++;

  const reveal = useCallback(
    (row: number | null, col: number) => {
      const el = scroller.current;
      if (!el) return;
      const left = lefts[col];
      const right = lefts[col + 1];
      if (left < el.scrollLeft) el.scrollLeft = left;
      else if (right > el.scrollLeft + bodyW) el.scrollLeft = right - bodyW;
      if (row === null) return;
      const top = row * ROW_H;
      let target = realTop;
      if (top < realTop) target = top;
      else if (top + ROW_H > realTop + bodyH) target = top + ROW_H - bodyH;
      if (target !== realTop) el.scrollTop = realMax > 0 ? target * (maxScroll / realMax) : 0;
    },
    [lefts, bodyW, bodyH, realTop, realMax, maxScroll]
  );

  // Back to the top-left when the table itself is swapped (tab change, new file).
  const columnsKey = table.columns.map(c => c.name).join('\u0001');
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollLeft > Math.max(0, totalW - bodyW)) el.scrollLeft = 0;
  }, [columnsKey, totalW, bodyW]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!selection || ncols === 0) return;
    const page = Math.max(1, Math.floor(bodyH / ROW_H) - 1);
    let { row, col } = selection;
    const r = row ?? 0;
    switch (e.key) {
      case 'ArrowDown': row = Math.min(nrows - 1, row === null ? 0 : r + 1); break;
      case 'ArrowUp': row = row === null ? null : Math.max(0, r - 1); break;
      case 'ArrowRight': col = Math.min(ncols - 1, col + 1); break;
      case 'ArrowLeft': col = Math.max(0, col - 1); break;
      case 'PageDown': row = Math.min(nrows - 1, r + page); break;
      case 'PageUp': row = Math.max(0, r - page); break;
      case 'Home': if (e.ctrlKey) row = 0; else col = 0; break;
      case 'End': if (e.ctrlKey) row = nrows - 1; else col = ncols - 1; break;
      default: return;
    }
    e.preventDefault();
    if (row !== null && nrows === 0) row = null;
    onSelect({ row, col });
    reveal(row, col);
  };

  const startResize = (e: React.PointerEvent, name: string, startWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const move = (ev: PointerEvent) => {
      setWidths(w => ({ ...w, [name]: Math.max(MIN_COL, Math.round(startWidth + ev.clientX - startX)) }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const selCol = selection ? selection.col : -1;
  const selRow = selection ? selection.row : null;

  const headers = [];
  const cells = [];
  for (let c = firstCol; c <= lastCol && c < ncols; c++) {
    const col = table.columns[c];
    const x = lefts[c] - scroll.left;
    const w = lefts[c + 1] - lefts[c];
    const active = c === selCol;
    const missing = missingCount(col);
    headers.push(
      <div
        key={col.name}
        role="columnheader"
        aria-selected={active}
        onMouseDown={() => onSelect({ row: null, col: c })}
        className={`group absolute top-0 border-r border-border cursor-pointer select-none ${active ? 'bg-cell/60' : 'bg-surface hover:bg-raised'}`}
        style={{ left: x, width: w, height: HEAD_H }}
      >
        <div
          className={`flex items-center justify-center border-b border-border text-[11px] ${active ? 'text-text bg-primary/40' : 'text-muted'}`}
          style={{ height: LETTER_H }}
        >
          {colLetter(c)}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 border-b border-border" style={{ height: NAME_H }}>
          <span
            title={`${col.type} column`}
            className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-raised text-[10px] leading-none text-muted"
          >
            {TYPE_GLYPH[col.type]}
          </span>
          <span className="truncate text-[13px] font-medium text-text" title={col.name}>{col.name}</span>
          {missing > 0 && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full bg-warning"
              title={`${missing.toLocaleString()} missing value${missing === 1 ? '' : 's'}`}
            />
          )}
          {onFilterColumn && (
            <button
              type="button"
              aria-label={`Filter rows by ${col.name}`}
              title={`Filter rows by ${col.name}`}
              onMouseDown={e => e.stopPropagation()}
              onClick={() => onFilterColumn(col.name)}
              className="ml-auto shrink-0 p-0.5 rounded text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-text cursor-pointer"
            >
              <Filter className="w-3 h-3" />
            </button>
          )}
        </div>
        <div
          onPointerDown={e => startResize(e, col.name, w)}
          onMouseDown={e => e.stopPropagation()}
          className="absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize z-10 hover:bg-primary/60"
        />
      </div>
    );

    const align = col.type === 'number' ? 'justify-end tabular-nums' : '';
    for (let i = 0; i < rowCount; i++) {
      const viewRow = firstRow + i;
      const r = rowMap ? rowMap[viewRow] : viewRow;
      const v = col.values[r];
      const isActive = active && selRow === viewRow;
      const inSelectedCol = active && selRow === null;
      cells.push(
        <div
          key={`${c}:${viewRow}`}
          role="gridcell"
          onMouseDown={() => onSelect({ row: viewRow, col: c })}
          className={`absolute flex items-center px-2.5 border-r border-b border-border text-[13px] whitespace-nowrap overflow-hidden cursor-cell ${align} ${
            isActive ? 'bg-cell outline outline-2 -outline-offset-2 outline-primary z-[1]' : inSelectedCol ? 'bg-cell/35' : ''
          }`}
          style={{ left: x, top: i * ROW_H - offsetY, width: w, height: ROW_H }}
        >
          {v === null ? <span className="text-muted/70 italic text-xs">null</span> : <span className="truncate">{v}</span>}
        </div>
      );
    }
  }

  const gutter = [];
  for (let i = 0; i < rowCount; i++) {
    const viewRow = firstRow + i;
    const r = rowMap ? rowMap[viewRow] : viewRow;
    gutter.push(
      <div
        key={viewRow}
        className={`absolute left-0 flex items-center justify-end pr-2.5 border-r border-b border-border text-xs tabular-nums ${
          selRow === viewRow ? 'bg-primary/40 text-text' : 'bg-surface text-muted'
        }`}
        style={{ top: i * ROW_H - offsetY, width: GUTTER, height: ROW_H }}
      >
        {(r + 1).toLocaleString()}
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="grid"
      aria-rowcount={nrows}
      aria-colcount={ncols}
      aria-label="Dataset"
      className="h-full w-full overflow-auto bg-surface focus:outline-none"
    >
      <div style={{ width: GUTTER + totalW, height: HEAD_H + scrollH, minHeight: '100%', minWidth: '100%' }}>
        <div className="sticky top-0 left-0 overflow-hidden" style={{ width: view.w, height: view.h }}>
          {/* cells */}
          <div className="absolute overflow-hidden" style={{ left: GUTTER, top: HEAD_H, width: bodyW, height: bodyH }}>
            {cells}
          </div>
          {/* row numbers */}
          <div className="absolute overflow-hidden" style={{ left: 0, top: HEAD_H, width: GUTTER, height: bodyH }}>
            {gutter}
          </div>
          {/* column headers */}
          <div className="absolute overflow-hidden" style={{ left: GUTTER, top: 0, width: bodyW, height: HEAD_H }}>
            {headers}
          </div>
          <div className="absolute left-0 top-0 bg-surface border-r border-b border-border" style={{ width: GUTTER, height: HEAD_H }} />
        </div>
      </div>
    </div>
  );
}

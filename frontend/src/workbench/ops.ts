// Supported transformations. Each one is a pure function from a table and its
// recorded parameters to a new table, so the step list can be replayed, reordered,
// disabled and undone from the untouched original.

import type { Cell, ColType, Column, Table } from './table';
import { formatNumber, isNumeric, numbersOf, parseDate } from './table';

export type ChangeKind = 'added' | 'modified' | 'removed' | 'renamed' | 'moved';
export type Params = Record<string, any>;

export interface OpResult {
  table: Table;
  changed: { column: string; change: ChangeKind }[];
  learned: Record<string, string>;
  rowsAffected: number;
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface Field {
  key: string;
  label: string;
  kind: 'column' | 'columns' | 'select' | 'text' | 'number' | 'toggle';
  accept?: ColType[];
  options?: (table: Table, params: Params) => FieldOption[];
  /** For `columns`: an empty selection is allowed and means this. */
  emptyMeans?: string;
  help?: string;
  showIf?: (params: Params) => boolean;
}

export type OpCategory = 'Column' | 'Rows' | 'Missing values' | 'Feature engineering';

export interface OpDef {
  id: string;
  label: string;
  category: OpCategory;
  effect: string;
  destructive?: boolean;
  fields: Field[];
  defaults: (table: Table, column?: Column) => Params;
  title: (params: Params) => string;
  columnsOf: (params: Params) => string[];
  apply: (table: Table, params: Params) => OpResult;
}

function indexOf(table: Table, name: string): number {
  const idx = table.columns.findIndex(c => c.name === name);
  if (idx === -1) throw new Error(`Column "${name}" does not exist at this point in the pipeline.`);
  return idx;
}

function requireColumns(params: Params, key = 'columns'): string[] {
  const cols: string[] = params[key] || [];
  if (cols.length === 0) throw new Error('Select at least one column.');
  return cols;
}

function takeRows(table: Table, rows: Int32Array): Table {
  return {
    nrows: rows.length,
    columns: table.columns.map(c => {
      const values: Cell[] = new Array(rows.length);
      for (let i = 0; i < rows.length; i++) values[i] = c.values[rows[i]];
      return { ...c, values };
    }),
  };
}

function keepWhere(table: Table, keep: (row: number) => boolean): Table {
  const rows: number[] = [];
  for (let r = 0; r < table.nrows; r++) if (keep(r)) rows.push(r);
  return rows.length === table.nrows ? table : takeRows(table, Int32Array.from(rows));
}

function uniqueName(table: Table, base: string, taken: Set<string>): string {
  let name = base;
  let k = 2;
  while (taken.has(name) || table.columns.some(c => c.name === name)) name = `${base}_${k++}`;
  taken.add(name);
  return name;
}

function list(names: string[], max = 6): string {
  return names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

function sortedValid(values: Cell[]): Float64Array {
  const nums = numbersOf(values);
  let count = 0;
  for (let i = 0; i < nums.length; i++) if (!isNaN(nums[i])) count++;
  const out = new Float64Array(count);
  let k = 0;
  for (let i = 0; i < nums.length; i++) if (!isNaN(nums[i])) out[k++] = nums[i];
  out.sort();
  return out;
}

export function quantile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const typeOptions = (): FieldOption[] => [
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date / time' },
];

const FILTER_OPERATORS: FieldOption[] = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'gt', label: 'is greater than' },
  { value: 'gte', label: 'is greater than or equal to' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is less than or equal to' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_missing', label: 'is missing' },
  { value: 'not_missing', label: 'is not missing' },
];

const operatorLabel = (op: string) => FILTER_OPERATORS.find(o => o.value === op)?.label || op;
const needsValue = (op: string) => op !== 'is_missing' && op !== 'not_missing';

const NUMERIC_FUNCTIONS: Record<string, { label: string; fn: (x: number) => number }> = {
  log1p: { label: 'log(1 + x)', fn: x => (x > -1 ? Math.log1p(x) : NaN) },
  sqrt: { label: 'square root', fn: x => (x >= 0 ? Math.sqrt(x) : NaN) },
  square: { label: 'square', fn: x => x * x },
  abs: { label: 'absolute value', fn: Math.abs },
  round: { label: 'round to integer', fn: Math.round },
};

const DATE_PARTS: Record<string, { label: string; period?: number; get: (d: Date) => number }> = {
  year: { label: 'year', get: d => d.getFullYear() },
  month: { label: 'month', period: 12, get: d => d.getMonth() + 1 },
  day: { label: 'day of month', get: d => d.getDate() },
  weekday: { label: 'weekday (0 = Monday)', period: 7, get: d => (d.getDay() + 6) % 7 },
  hour: { label: 'hour', period: 24, get: d => d.getHours() },
};

export const OPS: OpDef[] = [
  {
    id: 'rename_column',
    label: 'Rename column',
    category: 'Column',
    effect: 'Changes the column name. Values are untouched.',
    fields: [
      { key: 'column', label: 'Column', kind: 'column' },
      { key: 'new_name', label: 'New name', kind: 'text' },
    ],
    defaults: (_t, col) => ({ column: col?.name || '', new_name: '' }),
    title: p => `Renamed ${p.column} to ${p.new_name}`,
    columnsOf: p => [p.column],
    apply(table, p) {
      const idx = indexOf(table, p.column);
      const name = String(p.new_name || '').trim();
      if (name === '') throw new Error('Enter a new name.');
      if (table.columns.some((c, i) => i !== idx && c.name === name)) {
        throw new Error(`A column named "${name}" already exists.`);
      }
      const columns = table.columns.slice();
      columns[idx] = { ...columns[idx], name };
      return {
        table: { ...table, columns },
        changed: [{ column: name, change: 'renamed' }],
        learned: { from: p.column, to: name },
        rowsAffected: 0,
      };
    },
  },
  {
    id: 'delete_column',
    label: 'Delete column',
    category: 'Column',
    destructive: true,
    effect: 'Removes the selected columns from the working dataset.',
    fields: [{ key: 'columns', label: 'Columns to delete', kind: 'columns' }],
    defaults: (_t, col) => ({ columns: col ? [col.name] : [] }),
    title: p => `Deleted column ${list(p.columns, 2)}`,
    columnsOf: p => p.columns,
    apply(table, p) {
      const cols = requireColumns(p);
      cols.forEach(c => indexOf(table, c));
      if (cols.length >= table.columns.length) throw new Error('At least one column has to remain.');
      const drop = new Set(cols);
      return {
        table: { ...table, columns: table.columns.filter(c => !drop.has(c.name)) },
        changed: cols.map(column => ({ column, change: 'removed' as const })),
        learned: { removed: list(cols) },
        rowsAffected: 0,
      };
    },
  },
  {
    id: 'change_type',
    label: 'Change data type',
    category: 'Column',
    effect: 'Reinterprets the column as another type. Values that do not fit the new type become missing.',
    fields: [
      { key: 'column', label: 'Column', kind: 'column' },
      { key: 'to', label: 'New type', kind: 'select', options: typeOptions },
    ],
    defaults: (_t, col) => ({ column: col?.name || '', to: col?.type === 'number' ? 'text' : 'number' }),
    title: p => `Changed ${p.column} to ${p.to}`,
    columnsOf: p => [p.column],
    apply(table, p) {
      const idx = indexOf(table, p.column);
      const col = table.columns[idx];
      const to = p.to as ColType;
      if (col.type === to) throw new Error(`"${col.name}" is already ${to}.`);
      let lost = 0;
      let values = col.values;
      if (to !== 'text') {
        const fits = to === 'number' ? isNumeric : (v: string) => parseDate(v) !== null;
        values = col.values.map(v => {
          if (v === null || fits(v)) return v;
          lost++;
          return null;
        });
        if (lost === 0) values = col.values;
      }
      const columns = table.columns.slice();
      columns[idx] = { ...col, type: to, values };
      return {
        table: { ...table, columns },
        changed: [{ column: col.name, change: 'modified' }],
        learned: { from: col.type, to, 'values set to missing': lost.toLocaleString() },
        rowsAffected: lost,
      };
    },
  },
  {
    id: 'move_column',
    label: 'Reorder column',
    category: 'Column',
    effect: 'Moves the column to a new position. Values are untouched.',
    fields: [
      { key: 'column', label: 'Column', kind: 'column' },
      { key: 'position', label: 'New position (1 = first)', kind: 'number' },
    ],
    defaults: (_t, col) => ({ column: col?.name || '', position: 1 }),
    title: p => `Moved ${p.column} to position ${p.position}`,
    columnsOf: p => [p.column],
    apply(table, p) {
      const idx = indexOf(table, p.column);
      const pos = Math.round(Number(p.position));
      if (!(pos >= 1 && pos <= table.columns.length)) {
        throw new Error(`Position must be between 1 and ${table.columns.length}.`);
      }
      if (pos - 1 === idx) throw new Error(`"${p.column}" is already at position ${pos}.`);
      const columns = table.columns.slice();
      const [col] = columns.splice(idx, 1);
      columns.splice(pos - 1, 0, col);
      return {
        table: { ...table, columns },
        changed: [{ column: p.column, change: 'moved' }],
        learned: { 'from position': String(idx + 1), 'to position': String(pos) },
        rowsAffected: 0,
      };
    },
  },
  {
    id: 'remove_duplicates',
    label: 'Remove duplicate rows',
    category: 'Rows',
    destructive: true,
    effect: 'Keeps the first occurrence of each row and removes later repeats.',
    fields: [
      {
        key: 'columns',
        label: 'Compare on',
        kind: 'columns',
        emptyMeans: 'all columns',
        help: 'Leave empty to compare whole rows.',
      },
    ],
    defaults: () => ({ columns: [] }),
    title: () => 'Removed duplicate rows',
    columnsOf: p => p.columns || [],
    apply(table, p) {
      const names: string[] = p.columns && p.columns.length > 0 ? p.columns : table.columns.map(c => c.name);
      const cols = names.map(nm => table.columns[indexOf(table, nm)].values);
      const seen = new Set<string>();
      const out = keepWhere(table, r => {
        let key = '';
        for (let c = 0; c < cols.length; c++) {
          const v = cols[c][r];
          key += v === null ? '\u0000' : v;
          key += '\u0001';
        }
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const removed = table.nrows - out.nrows;
      return {
        table: out,
        changed: [],
        learned: {
          'compared on': p.columns && p.columns.length > 0 ? list(names) : 'all columns',
          kept: 'first occurrence',
          'rows removed': removed.toLocaleString(),
        },
        rowsAffected: removed,
      };
    },
  },
  {
    id: 'filter_rows',
    label: 'Filter rows',
    category: 'Rows',
    destructive: true,
    effect: 'Keeps only the rows that match the condition and removes the rest.',
    fields: [
      { key: 'column', label: 'Column', kind: 'column' },
      { key: 'operator', label: 'Keep rows where value', kind: 'select', options: () => FILTER_OPERATORS },
      { key: 'value', label: 'Value', kind: 'text', showIf: p => needsValue(p.operator) },
    ],
    defaults: (_t, col) => ({ column: col?.name || '', operator: 'eq', value: '' }),
    title: p => `Filtered ${p.column} ${operatorLabel(p.operator)}${needsValue(p.operator) ? ` ${p.value}` : ''}`,
    columnsOf: p => [p.column],
    apply(table, p) {
      const col = table.columns[indexOf(table, p.column)];
      const op: string = p.operator;
      const raw = String(p.value ?? '');
      const ordered = op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte';
      let test: (v: Cell, r: number) => boolean;

      if (op === 'is_missing') test = v => v === null;
      else if (op === 'not_missing') test = v => v !== null;
      else if (op === 'contains' || op === 'not_contains') {
        if (raw === '') throw new Error('Enter the text to look for.');
        const needle = raw.toLowerCase();
        const want = op === 'contains';
        test = v => v !== null && v.toLowerCase().includes(needle) === want;
      } else if (col.type === 'number' || (col.type === 'date' && ordered)) {
        let target: number;
        let nums: Float64Array;
        if (col.type === 'number') {
          if (!isNumeric(raw)) throw new Error(`"${raw}" is not a number, but "${col.name}" is a number column.`);
          target = Number(raw);
          nums = numbersOf(col.values);
        } else {
          const d = parseDate(raw);
          if (!d) throw new Error(`"${raw}" is not a recognised date (use YYYY-MM-DD).`);
          target = d.getTime();
          nums = Float64Array.from(col.values, v => (v === null ? NaN : parseDate(v)?.getTime() ?? NaN));
        }
        const cmp: Record<string, (x: number) => boolean> = {
          eq: x => x === target,
          neq: x => x !== target,
          gt: x => x > target,
          gte: x => x >= target,
          lt: x => x < target,
          lte: x => x <= target,
        };
        const f = cmp[op];
        test = (_v, r) => !isNaN(nums[r]) && f(nums[r]);
      } else if (ordered) {
        throw new Error(`"${operatorLabel(op)}" needs a number or date column; "${col.name}" is text.`);
      } else {
        const want = op === 'eq';
        test = v => v !== null && (v === raw) === want;
      }

      const out = keepWhere(table, r => test(col.values[r], r));
      const removed = table.nrows - out.nrows;
      return {
        table: out,
        changed: [],
        learned: {
          condition: `${col.name} ${operatorLabel(op)}${needsValue(op) ? ` ${raw}` : ''}`,
          'rows kept': out.nrows.toLocaleString(),
          'rows removed': removed.toLocaleString(),
        },
        rowsAffected: removed,
      };
    },
  },
  {
    id: 'drop_missing',
    label: 'Remove rows with missing values',
    category: 'Missing values',
    destructive: true,
    effect: 'Removes every row that has a missing value in the chosen columns.',
    fields: [
      {
        key: 'columns',
        label: 'Check columns',
        kind: 'columns',
        emptyMeans: 'any column',
        help: 'Leave empty to drop rows with a missing value anywhere.',
      },
    ],
    defaults: (_t, col) => ({ columns: col ? [col.name] : [] }),
    title: p => (p.columns && p.columns.length > 0 ? `Dropped rows missing ${list(p.columns, 2)}` : 'Dropped rows with missing values'),
    columnsOf: p => p.columns || [],
    apply(table, p) {
      const names: string[] = p.columns && p.columns.length > 0 ? p.columns : table.columns.map(c => c.name);
      const cols = names.map(nm => table.columns[indexOf(table, nm)].values);
      const out = keepWhere(table, r => {
        for (let c = 0; c < cols.length; c++) if (cols[c][r] === null) return false;
        return true;
      });
      const removed = table.nrows - out.nrows;
      return {
        table: out,
        changed: [],
        learned: {
          checked: p.columns && p.columns.length > 0 ? list(names) : 'any column',
          'rows removed': removed.toLocaleString(),
        },
        rowsAffected: removed,
      };
    },
  },
  {
    id: 'sort_rows',
    label: 'Sort rows',
    category: 'Rows',
    effect: 'Reorders the rows by one column. Missing values go last; ties keep their current order.',
    fields: [
      { key: 'column', label: 'Sort by', kind: 'column' },
      {
        key: 'direction',
        label: 'Order',
        kind: 'select',
        options: () => [
          { value: 'asc', label: 'Ascending' },
          { value: 'desc', label: 'Descending' },
        ],
      },
    ],
    defaults: (_t, col) => ({ column: col?.name || '', direction: 'asc' }),
    title: p => `Sorted by ${p.column} (${p.direction === 'desc' ? 'descending' : 'ascending'})`,
    columnsOf: p => [p.column],
    apply(table, p) {
      const col = table.columns[indexOf(table, p.column)];
      const sign = p.direction === 'desc' ? -1 : 1;
      const order = new Int32Array(table.nrows);
      for (let i = 0; i < order.length; i++) order[i] = i;

      if (col.type === 'text') {
        const v = col.values;
        order.sort((a, b) => {
          const x = v[a];
          const y = v[b];
          if (x === null || y === null) return x === y ? a - b : x === null ? 1 : -1;
          return x < y ? -sign : x > y ? sign : a - b;
        });
      } else {
        const keys =
          col.type === 'number'
            ? numbersOf(col.values)
            : Float64Array.from(col.values, v => (v === null ? NaN : parseDate(v)?.getTime() ?? NaN));
        order.sort((a, b) => {
          const x = keys[a];
          const y = keys[b];
          const xn = isNaN(x);
          const yn = isNaN(y);
          if (xn || yn) return xn === yn ? a - b : xn ? 1 : -1;
          return x < y ? -sign : x > y ? sign : a - b;
        });
      }

      let moved = 0;
      for (let i = 0; i < order.length; i++) if (order[i] !== i) moved++;
      return {
        table: moved === 0 ? table : takeRows(table, order),
        changed: [],
        learned: {
          'sorted by': col.name,
          order: p.direction === 'desc' ? 'descending' : 'ascending',
          'rows moved': moved.toLocaleString(),
        },
        rowsAffected: moved,
      };
    },
  },
  {
    id: 'fill_missing',
    label: 'Fill missing values',
    category: 'Missing values',
    effect: 'Replaces missing values with a value learned from each column, or with a constant.',
    fields: [
      { key: 'columns', label: 'Columns', kind: 'columns' },
      {
        key: 'strategy',
        label: 'Fill with',
        kind: 'select',
        options: (table, p) => {
          const chosen: string[] = p.columns || [];
          const allNumeric =
            chosen.length > 0 && chosen.every(nm => table.columns.find(c => c.name === nm)?.type === 'number');
          return [
            ...(allNumeric
              ? [
                  { value: 'mean', label: 'Mean' },
                  { value: 'median', label: 'Median' },
                ]
              : []),
            { value: 'mode', label: 'Most frequent value (mode)' },
            { value: 'constant', label: 'A constant' },
          ];
        },
        help: 'Mean and median are offered only when every selected column is numeric.',
      },
      { key: 'value', label: 'Constant', kind: 'text', showIf: p => p.strategy === 'constant' },
    ],
    defaults: (_t, col) => ({
      columns: col ? [col.name] : [],
      strategy: col?.type === 'number' ? 'median' : 'mode',
      value: '',
    }),
    title: p => `Filled missing ${list(p.columns, 2)} with ${p.strategy === 'constant' ? `"${p.value}"` : p.strategy}`,
    columnsOf: p => p.columns,
    apply(table, p) {
      const names = requireColumns(p);
      const strategy: string = p.strategy;
      const columns = table.columns.slice();
      const learned: Record<string, string> = { strategy };
      const changed: OpResult['changed'] = [];
      const touched = new Uint8Array(table.nrows);

      for (const name of names) {
        const idx = indexOf(table, name);
        const col = columns[idx];
        let fill: string;
        if (strategy === 'mean' || strategy === 'median') {
          if (col.type !== 'number') throw new Error(`${strategy} needs a number column; "${name}" is ${col.type}.`);
          const sorted = sortedValid(col.values);
          if (sorted.length === 0) throw new Error(`"${name}" has no values to compute a ${strategy} from.`);
          let value: number;
          if (strategy === 'median') value = quantile(sorted, 0.5);
          else {
            let sum = 0;
            for (let i = 0; i < sorted.length; i++) sum += sorted[i];
            value = sum / sorted.length;
          }
          fill = formatNumber(value);
        } else if (strategy === 'mode') {
          const counts = new Map<string, number>();
          let best: string | null = null;
          let bestCount = 0;
          for (const v of col.values) {
            if (v === null) continue;
            const c = (counts.get(v) || 0) + 1;
            counts.set(v, c);
            if (c > bestCount) {
              best = v;
              bestCount = c;
            }
          }
          if (best === null) throw new Error(`"${name}" has no values to take a mode from.`);
          fill = best;
        } else {
          fill = String(p.value ?? '');
          if (fill.trim() === '') throw new Error('Enter the constant to fill with.');
          if (col.type === 'number' && !isNumeric(fill)) {
            throw new Error(`"${fill}" is not a number, but "${name}" is a number column.`);
          }
        }

        let filled = 0;
        const values = col.values.map((v, r) => {
          if (v !== null) return v;
          filled++;
          touched[r] = 1;
          return fill;
        });
        learned[`fill value for ${name}`] = fill;
        learned[`cells filled in ${name}`] = filled.toLocaleString();
        if (filled > 0) {
          columns[idx] = { ...col, values };
          changed.push({ column: name, change: 'modified' });
        }
      }

      let rows = 0;
      for (let r = 0; r < touched.length; r++) rows += touched[r];
      return { table: { ...table, columns }, changed, learned, rowsAffected: rows };
    },
  },
  {
    id: 'one_hot',
    label: 'One-hot encode',
    category: 'Feature engineering',
    effect: 'Adds one 0/1 column per distinct value. Missing values get 0 in every new column.',
    fields: [
      { key: 'column', label: 'Categorical column', kind: 'column', accept: ['text'] },
      {
        key: 'keep_original',
        label: 'Keep the original column',
        kind: 'toggle',
      },
    ],
    defaults: (_t, col) => ({ column: col?.type === 'text' ? col.name : '', keep_original: false }),
    title: p => `One-hot encoded ${p.column}`,
    columnsOf: p => [p.column],
    apply(table, p) {
      const idx = indexOf(table, p.column);
      const col = table.columns[idx];
      const cats = Array.from(new Set(col.values.filter((v): v is string => v !== null))).sort();
      if (cats.length === 0) throw new Error(`"${col.name}" has no values to encode.`);
      if (cats.length > 50) {
        throw new Error(
          `"${col.name}" has ${cats.length.toLocaleString()} distinct values. One-hot encoding is limited to 50 to avoid creating an unusable table.`
        );
      }
      const taken = new Set<string>();
      const added: Column[] = cats.map(cat => ({
        name: uniqueName(table, `${col.name}_${cat}`, taken),
        type: 'number' as const,
        values: col.values.map(v => (v === cat ? '1' : '0')),
      }));
      const columns = table.columns.slice();
      if (p.keep_original) columns.splice(idx + 1, 0, ...added);
      else columns.splice(idx, 1, ...added);
      return {
        table: { ...table, columns },
        changed: [
          ...added.map(c => ({ column: c.name, change: 'added' as const })),
          ...(p.keep_original ? [] : [{ column: col.name, change: 'removed' as const }]),
        ],
        learned: {
          source: col.name,
          categories: `${cats.length} (${list(cats, 8)})`,
          'original column': p.keep_original ? 'kept' : 'removed',
        },
        rowsAffected: 0,
      };
    },
  },
  {
    id: 'extract_datetime',
    label: 'Extract date parts',
    category: 'Feature engineering',
    effect: 'Adds numeric columns for the chosen parts of a date/time column.',
    fields: [
      { key: 'column', label: 'Date column', kind: 'column', accept: ['date'] },
      {
        key: 'parts',
        label: 'Parts',
        kind: 'columns',
        options: () => Object.entries(DATE_PARTS).map(([value, d]) => ({ value, label: d.label })),
      },
      {
        key: 'cyclical',
        label: 'Also add sin/cos pairs for month, weekday and hour',
        kind: 'toggle',
        help: 'Cyclical encoding puts hour 23 next to hour 0.',
      },
    ],
    defaults: (_t, col) => ({
      column: col?.type === 'date' ? col.name : '',
      parts: ['hour', 'weekday', 'month'],
      cyclical: false,
    }),
    title: p => `Split ${p.column} into ${list(p.parts, 3)}`,
    columnsOf: p => [p.column],
    apply(table, p) {
      const idx = indexOf(table, p.column);
      const col = table.columns[idx];
      const parts: string[] = requireColumns(p, 'parts');
      const dates = col.values.map(v => (v === null ? null : parseDate(v)));
      if (!dates.some(d => d !== null)) throw new Error(`"${col.name}" has no values that can be read as dates.`);

      const taken = new Set<string>();
      const added: Column[] = [];
      for (const part of parts) {
        const def = DATE_PARTS[part];
        if (!def) throw new Error(`Unknown date part "${part}".`);
        const nums = dates.map(d => (d ? def.get(d) : null));
        added.push({
          name: uniqueName(table, `${col.name}_${part}`, taken),
          type: 'number',
          values: nums.map(x => (x === null ? null : String(x))),
        });
        if (p.cyclical && def.period) {
          const period = def.period;
          for (const [suffix, f] of [['sin', Math.sin], ['cos', Math.cos]] as const) {
            added.push({
              name: uniqueName(table, `${col.name}_${part}_${suffix}`, taken),
              type: 'number',
              values: nums.map(x => (x === null ? null : formatNumber(Number(f((2 * Math.PI * x) / period).toFixed(6))))),
            });
          }
        }
      }
      const columns = table.columns.slice();
      columns.splice(idx + 1, 0, ...added);
      const learned: Record<string, string> = { source: col.name, parts: parts.join(', ') };
      if (p.cyclical) learned.cyclical = 'sin/cos pairs added so the model sees the last value next to the first';
      return {
        table: { ...table, columns },
        changed: added.map(c => ({ column: c.name, change: 'added' as const })),
        learned,
        rowsAffected: 0,
      };
    },
  },
  {
    id: 'numeric_transform',
    label: 'Numeric transformation',
    category: 'Feature engineering',
    effect: 'Applies a function to every value in the selected numeric columns, in place. Values outside the function\'s domain become missing.',
    fields: [
      { key: 'columns', label: 'Numeric columns', kind: 'columns', accept: ['number'] },
      {
        key: 'fn',
        label: 'Function',
        kind: 'select',
        options: () => Object.entries(NUMERIC_FUNCTIONS).map(([value, d]) => ({ value, label: d.label })),
      },
    ],
    defaults: (_t, col) => ({ columns: col?.type === 'number' ? [col.name] : [], fn: 'log1p' }),
    title: p => `Applied ${NUMERIC_FUNCTIONS[p.fn]?.label || p.fn} to ${list(p.columns, 2)}`,
    columnsOf: p => p.columns,
    apply(table, p) {
      const names = requireColumns(p);
      const def = NUMERIC_FUNCTIONS[p.fn];
      if (!def) throw new Error(`Unknown function "${p.fn}".`);
      const columns = table.columns.slice();
      let invalid = 0;
      let rows = 0;
      for (const name of names) {
        const idx = indexOf(table, name);
        const col = columns[idx];
        if (col.type !== 'number') throw new Error(`"${name}" is ${col.type}, not a number column.`);
        const nums = numbersOf(col.values);
        const values: Cell[] = new Array(nums.length);
        for (let r = 0; r < nums.length; r++) {
          if (isNaN(nums[r])) {
            values[r] = null;
            continue;
          }
          const y = def.fn(nums[r]);
          if (isFinite(y)) values[r] = formatNumber(y);
          else {
            values[r] = null;
            invalid++;
          }
        }
        rows = Math.max(rows, nums.length);
        columns[idx] = { ...col, values };
      }
      return {
        table: { ...table, columns },
        changed: names.map(column => ({ column, change: 'modified' as const })),
        learned: {
          function: def.label,
          columns: list(names),
          'values outside the domain (set to missing)': invalid.toLocaleString(),
        },
        rowsAffected: rows,
      };
    },
  },
  {
    id: 'scale',
    label: 'Normalize / standardize',
    category: 'Feature engineering',
    effect: 'Rescales the selected numeric columns in place, using statistics computed from the current rows.',
    fields: [
      { key: 'columns', label: 'Numeric columns', kind: 'columns', accept: ['number'] },
      {
        key: 'method',
        label: 'Method',
        kind: 'select',
        options: () => [
          { value: 'standardize', label: 'Standardize (mean 0, std 1)' },
          { value: 'minmax', label: 'Normalize to 0–1 (min-max)' },
        ],
        help: 'The statistics come from all current rows. If you later split into train and test sets, this leaks test information into training.',
      },
    ],
    defaults: (_t, col) => ({ columns: col?.type === 'number' ? [col.name] : [], method: 'standardize' }),
    title: p => `${p.method === 'minmax' ? 'Normalized' : 'Standardized'} ${list(p.columns, 2)}`,
    columnsOf: p => p.columns,
    apply(table, p) {
      const names = requireColumns(p);
      const columns = table.columns.slice();
      const learned: Record<string, string> = { method: p.method === 'minmax' ? 'min-max' : 'z-score (population std)' };
      for (const name of names) {
        const idx = indexOf(table, name);
        const col = columns[idx];
        if (col.type !== 'number') throw new Error(`"${name}" is ${col.type}, not a number column.`);
        const nums = numbersOf(col.values);
        let count = 0;
        let sum = 0;
        let min = Infinity;
        let max = -Infinity;
        for (let r = 0; r < nums.length; r++) {
          const x = nums[r];
          if (isNaN(x)) continue;
          count++;
          sum += x;
          if (x < min) min = x;
          if (x > max) max = x;
        }
        if (count === 0) throw new Error(`"${name}" has no numeric values.`);
        const mean = sum / count;
        let ss = 0;
        for (let r = 0; r < nums.length; r++) if (!isNaN(nums[r])) ss += (nums[r] - mean) ** 2;
        const std = Math.sqrt(ss / count);

        let shift: number;
        let scale: number;
        if (p.method === 'minmax') {
          if (max === min) throw new Error(`"${name}" is constant (${formatNumber(min)}), so it cannot be normalized.`);
          shift = min;
          scale = max - min;
          learned[`${name} min`] = formatNumber(min);
          learned[`${name} max`] = formatNumber(max);
        } else {
          if (std === 0) throw new Error(`"${name}" is constant (${formatNumber(mean)}), so it cannot be standardized.`);
          shift = mean;
          scale = std;
          learned[`${name} mean`] = formatNumber(mean);
          learned[`${name} std`] = formatNumber(std);
        }
        const values: Cell[] = new Array(nums.length);
        for (let r = 0; r < nums.length; r++) {
          values[r] = isNaN(nums[r]) ? null : formatNumber(Number(((nums[r] - shift) / scale).toFixed(8)));
        }
        columns[idx] = { ...col, values };
      }
      return {
        table: { ...table, columns },
        changed: names.map(column => ({ column, change: 'modified' as const })),
        learned,
        rowsAffected: table.nrows,
      };
    },
  },
];

export const OP_BY_ID: Record<string, OpDef> = Object.fromEntries(OPS.map(op => [op.id, op]));

export const OP_CATEGORIES: OpCategory[] = ['Column', 'Rows', 'Missing values', 'Feature engineering'];

/** Whether the operation makes sense for the given column type (used to disable menu items). */
export function opAccepts(op: OpDef, type: ColType | undefined): boolean {
  const first = op.fields[0];
  if (!first || !first.accept || type === undefined) return true;
  return first.accept.includes(type);
}

import type { ColType, Column, Table } from './table';
import { numbersOf, parseDate } from './table';
import { quantile } from './ops';

export interface NumericStats {
  valid: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  q1: number;
  q3: number;
  iqr: number;
  histogram: { x0: number; x1: number; count: number }[];
  outliers: number;
}

export interface DateStats {
  min: string;
  max: string;
  bucketBy: 'year' | 'month';
  buckets: { label: string; count: number }[];
}

export interface ColumnStats {
  name: string;
  type: ColType;
  total: number;
  missing: number;
  unique: number;
  /** Non-missing values that repeat an earlier value. */
  duplicates: number;
  completeness: number;
  constant: boolean;
  identifierLike: boolean;
  topValues: { value: string; count: number }[];
  numeric?: NumericStats;
  date?: DateStats;
}

export interface QualityIssue {
  level: 'ok' | 'info' | 'warning';
  title: string;
  detail: string;
}

const statsCache = new WeakMap<Column, ColumnStats>();
const missingCache = new WeakMap<Column, number>();

export function missingCount(col: Column): number {
  let n = missingCache.get(col);
  if (n === undefined) {
    n = 0;
    for (let i = 0; i < col.values.length; i++) if (col.values[i] === null) n++;
    missingCache.set(col, n);
  }
  return n;
}

function numericStats(col: Column): NumericStats | undefined {
  const nums = numbersOf(col.values);
  let valid = 0;
  let sum = 0;
  for (let i = 0; i < nums.length; i++) {
    if (!isNaN(nums[i])) {
      valid++;
      sum += nums[i];
    }
  }
  if (valid === 0) return undefined;
  const sorted = new Float64Array(valid);
  let k = 0;
  for (let i = 0; i < nums.length; i++) if (!isNaN(nums[i])) sorted[k++] = nums[i];
  sorted.sort();

  const mean = sum / valid;
  let ss = 0;
  for (let i = 0; i < valid; i++) ss += (sorted[i] - mean) ** 2;
  const std = valid > 1 ? Math.sqrt(ss / (valid - 1)) : 0;
  const min = sorted[0];
  const max = sorted[valid - 1];
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;

  const bins = Math.min(24, Math.max(1, Math.ceil(Math.sqrt(valid))));
  const width = (max - min) / bins || 1;
  const histogram = Array.from({ length: bins }, (_, b) => ({ x0: min + b * width, x1: min + (b + 1) * width, count: 0 }));
  for (let i = 0; i < valid; i++) {
    const b = Math.min(bins - 1, Math.floor((sorted[i] - min) / width));
    histogram[b].count++;
  }

  let outliers = 0;
  if (iqr > 0) {
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    for (let i = 0; i < valid; i++) if (sorted[i] < lo || sorted[i] > hi) outliers++;
  }
  return { valid, min, max, mean, median: quantile(sorted, 0.5), std, q1, q3, iqr, histogram, outliers };
}

function dateStats(col: Column): DateStats | undefined {
  let min: Date | null = null;
  let max: Date | null = null;
  const dates: Date[] = [];
  for (const v of col.values) {
    if (v === null) continue;
    const d = parseDate(v);
    if (!d) continue;
    dates.push(d);
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  if (!min || !max) return undefined;
  const bucketBy = max.getFullYear() - min.getFullYear() >= 2 ? 'year' : 'month';
  const counts = new Map<string, number>();
  for (const d of dates) {
    const label =
      bucketBy === 'year' ? String(d.getFullYear()) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const buckets = Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => (a.label < b.label ? -1 : 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
  return { min: fmt(min), max: fmt(max), bucketBy, buckets };
}

export function columnStats(col: Column): ColumnStats {
  const cached = statsCache.get(col);
  if (cached) return cached;

  const counts = new Map<string, number>();
  let missing = 0;
  for (let i = 0; i < col.values.length; i++) {
    const v = col.values[i];
    if (v === null) missing++;
    else counts.set(v, (counts.get(v) || 0) + 1);
  }
  const total = col.values.length;
  const present = total - missing;
  const unique = counts.size;

  let topValues: { value: string; count: number }[] = [];
  if (unique <= 200000) {
    topValues = Array.from(counts, ([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1))
      .slice(0, 8);
  }

  const looksLikeId = /(^|[_\s-])(id|uuid|key)$/i.test(col.name) || /Id$/.test(col.name);
  const stats: ColumnStats = {
    name: col.name,
    type: col.type,
    total,
    missing,
    unique,
    duplicates: present - unique,
    completeness: total === 0 ? 0 : (present / total) * 100,
    constant: present > 0 && unique === 1,
    identifierLike: present > 1 && (looksLikeId || (col.type === 'text' && unique === present && present > 20)),
    topValues,
    numeric: col.type === 'number' ? numericStats(col) : undefined,
    date: col.type === 'date' ? dateStats(col) : undefined,
  };
  statsCache.set(col, stats);
  return stats;
}

export function columnQuality(s: ColumnStats): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const pct = (n: number) => (s.total === 0 ? '0' : ((n / s.total) * 100).toFixed(n / s.total < 0.01 ? 2 : 1));

  if (s.total === 0) {
    return [{ level: 'info', title: 'No rows', detail: 'The dataset has no rows, so nothing can be checked.' }];
  }

  if (s.missing === 0) {
    issues.push({ level: 'ok', title: 'No missing values', detail: `All ${s.total.toLocaleString()} values are present.` });
  } else if (s.missing === s.total) {
    issues.push({ level: 'warning', title: 'Column is entirely empty', detail: 'Every value is missing. The column carries no information.' });
  } else {
    issues.push({
      level: s.missing / s.total > 0.2 ? 'warning' : 'info',
      title: 'Missing values',
      detail: `${s.missing.toLocaleString()} of ${s.total.toLocaleString()} values (${pct(s.missing)}%) are missing.`,
    });
  }

  if (s.constant) {
    issues.push({
      level: 'warning',
      title: 'Constant column',
      detail: `Every present value is "${s.topValues[0]?.value ?? ''}". A constant column cannot help a model distinguish rows.`,
    });
  }

  if (s.identifierLike) {
    if (s.duplicates > 0) {
      issues.push({
        level: 'warning',
        title: 'Repeated identifiers',
        detail: `This looks like an identifier, but ${s.duplicates.toLocaleString()} value(s) repeat an earlier one.`,
      });
    } else {
      issues.push({
        level: 'info',
        title: 'Identifier column',
        detail: 'Every value is unique. Identifiers usually should not be used as model features.',
      });
    }
  }

  if (s.type === 'number' && s.numeric && !s.identifierLike) {
    if (s.numeric.outliers > 0) {
      issues.push({
        level: 'info',
        title: 'Potential outliers',
        detail: `${s.numeric.outliers.toLocaleString()} value(s) lie more than 1.5 × IQR outside the middle half. This is a statistical flag, not an error; check whether they are real measurements.`,
      });
    }
  }

  if (s.type === 'text' && s.topValues.length > 0) {
    const numericLooking = s.topValues.filter(t => t.value.trim() !== '' && isFinite(Number(t.value))).length;
    if (numericLooking > 0 && numericLooking >= s.topValues.length / 2) {
      issues.push({
        level: 'warning',
        title: 'Mixed types',
        detail: 'Most values look numeric but some do not, so the column was read as text. Non-numeric entries may be typos or placeholders.',
      });
    }
  }

  return issues;
}

export interface DatasetQuality {
  rows: number;
  columns: number;
  duplicateRows: number;
  cellsMissing: number;
  perColumn: ColumnStats[];
}

export function datasetQuality(table: Table): DatasetQuality {
  const perColumn = table.columns.map(columnStats);
  const seen = new Set<string>();
  let duplicateRows = 0;
  const cols = table.columns.map(c => c.values);
  for (let r = 0; r < table.nrows; r++) {
    let key = '';
    for (let c = 0; c < cols.length; c++) {
      const v = cols[c][r];
      key += v === null ? '\u0000' : v;
      key += '\u0001';
    }
    if (seen.has(key)) duplicateRows++;
    else seen.add(key);
  }
  return {
    rows: table.nrows,
    columns: table.columns.length,
    duplicateRows,
    cellsMissing: perColumn.reduce((a, s) => a + s.missing, 0),
    perColumn,
  };
}

export function formatStat(n: number): string {
  if (!isFinite(n)) return '–';
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString();
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 0.0001 || abs >= 1e9)) return n.toExponential(3);
  return String(parseFloat(n.toPrecision(4)));
}

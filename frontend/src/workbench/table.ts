// Column-oriented in-memory table used by the workspace.
// Cells keep their original text so untouched values export exactly as loaded.

export type ColType = 'number' | 'text' | 'date';
export type Cell = string | null;

export interface Column {
  name: string;
  type: ColType;
  values: Cell[];
}

export interface Table {
  columns: Column[];
  nrows: number;
}

export interface SchemaEntry {
  name: string;
  type: ColType;
}

export const MAX_FILE_BYTES = 200 * 1024 * 1024;

const MISSING_TOKENS = new Set(['', 'na', 'n/a', 'nan', 'null', 'none']);

export function isMissingToken(s: string): boolean {
  return s.length <= 4 && MISSING_TOKENS.has(s.trim().toLowerCase());
}

export class CsvError extends Error {}

function detectDelimiter(text: string): string {
  const end = text.indexOf('\n');
  const header = end === -1 ? text : text.slice(0, end);
  let best = ',';
  let bestCount = -1;
  for (const d of [',', ';', '\t', '|']) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < header.length; i++) {
      const ch = header[i];
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Parses the date formats the workspace recognises; returns null for anything else. */
export function parseDate(v: string): Date | null {
  const s = v.trim();
  let m = ISO_DAY.exec(s);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  if (ISO_DATE.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }
  m = SLASH_DATE.exec(s);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function isNumeric(v: string): boolean {
  const s = v.trim();
  return s !== '' && isFinite(Number(s));
}

export function inferType(values: Cell[]): ColType {
  let seen = false;
  let numeric = true;
  let date = true;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) continue;
    seen = true;
    if (numeric && !isNumeric(v)) numeric = false;
    if (date && parseDate(v) === null) date = false;
    if (!numeric && !date) return 'text';
  }
  if (!seen) return 'text';
  if (numeric) return 'number';
  return date ? 'date' : 'text';
}

export interface ParsedCsv {
  table: Table;
  delimiter: string;
  warnings: string[];
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (text.trim() === '') throw new CsvError('The file is empty.');

  const delim = detectDelimiter(text);
  const dc = delim.charCodeAt(0);
  const n = text.length;
  const warnings: string[] = [];

  let names: string[] | null = null;
  let cols: Cell[][] = [];
  let record: string[] = [];
  let line = 1;
  let shortRows = 0;
  let nrows = 0;

  const endRecord = () => {
    if (record.length === 1 && record[0].trim() === '') {
      record = [];
      return;
    }
    if (names === null) {
      names = record.map(h => h.trim());
      const seen = new Set<string>();
      names.forEach((h, idx) => {
        if (h === '') throw new CsvError(`Column ${idx + 1} has no name in the header row.`);
        if (seen.has(h)) throw new CsvError(`Duplicate column name "${h}" in the header row.`);
        seen.add(h);
      });
      cols = names.map(() => []);
    } else {
      if (record.length > names.length) {
        throw new CsvError(
          `Line ${line} has ${record.length} fields but the header has ${names.length}. The file is not a valid CSV.`
        );
      }
      if (record.length < names.length) shortRows++;
      for (let j = 0; j < names.length; j++) {
        const v = j < record.length ? record[j] : '';
        cols[j].push(isMissingToken(v) ? null : v);
      }
      nrows++;
    }
    record = [];
  };

  let i = 0;
  while (i < n) {
    if (text.charCodeAt(i) === 34) {
      // quoted field
      let out = '';
      i++;
      let closed = false;
      while (i < n) {
        const q = text.indexOf('"', i);
        if (q === -1) break;
        out += text.slice(i, q);
        if (text.charCodeAt(q + 1) === 34) {
          out += '"';
          i = q + 2;
        } else {
          i = q + 1;
          closed = true;
          break;
        }
      }
      if (!closed) throw new CsvError(`Unterminated quoted value starting near line ${line}.`);
      for (let k = 0; k < out.length; k++) if (out.charCodeAt(k) === 10) line++;
      record.push(out);
    } else {
      let j = i;
      while (j < n) {
        const c = text.charCodeAt(j);
        if (c === dc || c === 10 || c === 13) break;
        j++;
      }
      record.push(text.slice(i, j));
      i = j;
    }

    if (i >= n) {
      endRecord();
      break;
    }
    const c = text.charCodeAt(i);
    if (c === dc) {
      i++;
      if (i >= n) {
        record.push('');
        endRecord();
      }
    } else if (c === 13 || c === 10) {
      if (c === 13 && text.charCodeAt(i + 1) === 10) i++;
      i++;
      endRecord();
      line++;
    } else {
      throw new CsvError(`Unexpected character after a quoted value on line ${line}.`);
    }
  }
  if (record.length > 0) endRecord();

  if (names === null) throw new CsvError('The file has no header row.');
  const header: string[] = names;
  if (nrows === 0) warnings.push('The file has a header row but no data rows.');
  if (shortRows > 0) {
    warnings.push(`${shortRows.toLocaleString()} row(s) had fewer fields than the header; the gaps were read as missing.`);
  }

  const columns: Column[] = header.map((name, j) => ({ name, type: inferType(cols[j]), values: cols[j] }));
  return { table: { columns, nrows }, delimiter: delim, warnings };
}

function escapeField(v: string): string {
  if (v === '') return '';
  if (/[",\n\r]/.test(v) || v[0] === ' ' || v[v.length - 1] === ' ') {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

/** Serialises to comma-separated text, in chunks so large tables don't build one huge string. */
export function toCsvParts(table: Table): string[] {
  const parts: string[] = [table.columns.map(c => escapeField(c.name)).join(',') + '\n'];
  const cols = table.columns.map(c => c.values);
  const CHUNK = 20000;
  for (let start = 0; start < table.nrows; start += CHUNK) {
    const end = Math.min(table.nrows, start + CHUNK);
    const lines: string[] = [];
    for (let r = start; r < end; r++) {
      let s = '';
      for (let c = 0; c < cols.length; c++) {
        const v = cols[c][r];
        if (c > 0) s += ',';
        if (v !== null) s += escapeField(v);
      }
      lines.push(s);
    }
    parts.push(lines.join('\n') + '\n');
  }
  return parts;
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

const fingerprintCache = new WeakMap<Table, Promise<string>>();

/** SHA-256 of the table as it would be exported to CSV. */
export function fingerprintTable(table: Table): Promise<string> {
  let p = fingerprintCache.get(table);
  if (!p) {
    p = new Blob(toCsvParts(table)).arrayBuffer().then(sha256Hex);
    fingerprintCache.set(table, p);
  }
  return p;
}

const numberCache = new WeakMap<Cell[], Float64Array>();

/** Numeric view of a column; missing and non-numeric cells are NaN. */
export function numbersOf(values: Cell[]): Float64Array {
  let arr = numberCache.get(values);
  if (!arr) {
    arr = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      arr[i] = v === null || !isNumeric(v) ? NaN : Number(v);
    }
    numberCache.set(values, arr);
  }
  return arr;
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12)));
}

export function schemaOf(table: Table): SchemaEntry[] {
  return table.columns.map(c => ({ name: c.name, type: c.type }));
}

export function cellCount(table: Table): number {
  return table.nrows * table.columns.length;
}

export function colLetter(index: number): string {
  let s = '';
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { Column } from '../workbench/table';
import { columnQuality, columnStats, formatStat } from '../workbench/stats';
import type { ColumnStats } from '../workbench/stats';
import { TYPE_GLYPH } from './DataGrid';

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-medium text-text tabular-nums truncate" title={value}>{value}</div>
    </div>
  );
}

function Histogram({ stats }: { stats: ColumnStats }) {
  const n = stats.numeric!;
  const peak = Math.max(...n.histogram.map(b => b.count), 1);
  return (
    <div>
      <div className="flex items-end gap-px h-16" role="img" aria-label={`Histogram of ${stats.name} from ${formatStat(n.min)} to ${formatStat(n.max)}`}>
        {n.histogram.map((b, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/90 hover:bg-primary rounded-t-[1px]"
            style={{ height: `${b.count === 0 ? 0 : Math.max(3, (b.count / peak) * 100)}%` }}
            title={`${formatStat(b.x0)} to ${formatStat(b.x1)}: ${b.count.toLocaleString()}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted tabular-nums">
        <span>{formatStat(n.min)}</span>
        <span>{formatStat(n.max)}</span>
      </div>
    </div>
  );
}

function Bars({ rows, total }: { rows: { label: string; count: number }[]; total: number }) {
  const peak = Math.max(...rows.map(r => r.count), 1);
  return (
    <ul className="space-y-1.5">
      {rows.map(r => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-text truncate" title={r.label}>{r.label}</span>
            <span className="text-muted tabular-nums shrink-0">
              {r.count.toLocaleString()} · {total === 0 ? 0 : ((r.count / total) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-0.5 h-1.5 rounded-sm bg-raised">
            <div className="h-full rounded-sm bg-primary" style={{ width: `${(r.count / peak) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ColumnInspector({ column, onClose }: { column: Column | null; onClose: () => void }) {
  const stats = useMemo(() => (column ? columnStats(column) : null), [column]);
  const issues = useMemo(() => (stats ? columnQuality(stats) : []), [stats]);

  return (
    <div className="h-full flex flex-col bg-panel min-w-0">
      <div className="h-9 px-3.5 flex items-center justify-between border-b border-border shrink-0">
        <span className="caps">Column inspector</span>
        <button type="button" className="tool !w-6 !h-6" onClick={onClose} title="Hide inspector" aria-label="Hide inspector">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {!column || !stats ? (
        <p className="px-4 py-3 text-xs leading-relaxed text-muted">
          Select a column or a cell to see its summary, distribution and data-quality checks.
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <section className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-primary/25 text-[11px] text-primary font-semibold">
                {TYPE_GLYPH[stats.type]}
              </span>
              <h3 className="text-base font-semibold text-text truncate" title={stats.name}>{stats.name}</h3>
            </div>
            <div className="mt-1 text-xs text-muted">
              {stats.type === 'number' ? 'Number' : stats.type === 'date' ? 'Date / time' : 'Text'}
              {stats.identifierLike ? ' · looks like an identifier' : ''}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5">
              <Pair label="Values" value={stats.total.toLocaleString()} />
              <Pair label="Unique" value={stats.unique.toLocaleString()} />
              <Pair label="Missing" value={stats.missing.toLocaleString()} />
              <Pair label="Complete" value={`${stats.completeness.toFixed(stats.completeness === 100 ? 0 : 1)}%`} />
            </div>
          </section>

          <section className="px-4 py-3.5 border-b border-border">
            <div className="caps mb-3">Distribution</div>
            {stats.type === 'number' ? (
              stats.numeric ? (
                <Histogram stats={stats} />
              ) : (
                <p className="text-xs text-muted">This column has no numeric values, so there is nothing to plot.</p>
              )
            ) : stats.type === 'date' ? (
              stats.date ? (
                <Bars rows={stats.date.buckets.slice(-12)} total={stats.total - stats.missing} />
              ) : (
                <p className="text-xs text-muted">No values could be read as dates.</p>
              )
            ) : stats.identifierLike && stats.duplicates === 0 ? (
              <p className="text-xs text-muted">Every value is unique, so a frequency chart would not be informative.</p>
            ) : stats.topValues.length > 0 ? (
              <Bars rows={stats.topValues.map(t => ({ label: t.value, count: t.count }))} total={stats.total - stats.missing} />
            ) : (
              <p className="text-xs text-muted">
                {stats.total === stats.missing ? 'The column has no values.' : 'Too many distinct values to chart.'}
              </p>
            )}
            {stats.type === 'text' && stats.unique > stats.topValues.length && stats.topValues.length > 0 && !(stats.identifierLike && stats.duplicates === 0) && (
              <p className="mt-2 text-[11px] text-muted">
                Showing the {stats.topValues.length} most common of {stats.unique.toLocaleString()} categories.
              </p>
            )}
            {stats.date && stats.date.buckets.length > 12 && (
              <p className="mt-2 text-[11px] text-muted">Showing the latest 12 of {stats.date.buckets.length} {stats.date.bucketBy}s.</p>
            )}
          </section>

          {stats.numeric && (
            <section className="px-4 py-3.5 border-b border-border">
              <div className="caps mb-3">Statistics</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <Pair label="Mean" value={formatStat(stats.numeric.mean)} />
                <Pair label="Std dev" value={formatStat(stats.numeric.std)} />
                <Pair label="Minimum" value={formatStat(stats.numeric.min)} />
                <Pair label="Maximum" value={formatStat(stats.numeric.max)} />
                <Pair label="Median" value={formatStat(stats.numeric.median)} />
                <Pair label="Q1 – Q3" value={`${formatStat(stats.numeric.q1)} – ${formatStat(stats.numeric.q3)}`} />
              </div>
            </section>
          )}

          {stats.date && (
            <section className="px-4 py-3.5 border-b border-border">
              <div className="caps mb-3">Range</div>
              <div className="grid grid-cols-1 gap-y-3.5">
                <Pair label="Earliest" value={stats.date.min} />
                <Pair label="Latest" value={stats.date.max} />
              </div>
            </section>
          )}

          {stats.type === 'text' && (
            <section className="px-4 py-3.5 border-b border-border">
              <div className="caps mb-3">Categories</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <Pair label="Distinct" value={stats.unique.toLocaleString()} />
                <Pair label="Repeated values" value={stats.duplicates.toLocaleString()} />
              </div>
            </section>
          )}

          <section className="px-4 py-3.5">
            <div className="caps mb-3">Data quality</div>
            <ul className="space-y-2.5">
              {issues.map(issue => (
                <li key={issue.title} className="flex items-start gap-2">
                  {issue.level === 'ok' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  ) : issue.level === 'warning' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-text">{issue.title}</div>
                    <div className="text-xs text-muted leading-relaxed">{issue.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

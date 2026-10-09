import { Fragment, useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, ChevronDown, ChevronRight, Download, RotateCw } from 'lucide-react';
import { Btn, Page, SectionLabel, Stat, Tag, Th, statusTone } from '../components/ui';
import { fetchExperiments } from '../services/api';
import type { AuditStatus, Experiment } from '../types';
import { useWorkbench } from '../workbench/store';
import { METRIC_TOLERANCE, overallStatus } from '../workbench/audit';

const FILTERS = ['ALL', 'PASS', 'WARNING', 'FAIL', 'NOT CHECKED'] as const;

function Detail({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div>
      <dt className={`caps !text-[10px] ${tone ?? ''}`}>{label}</dt>
      <dd className="text-text mt-0.5 whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}

export default function ReproducibilityAudit() {
  const wb = useWorkbench();
  const { audit, auditRunning, runAuditNow, findings, reproduction, reproducing } = wb;
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string>("exp-baseline");
  const [comparisonExpId, setComparisonExpId] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>("ALL");

  useEffect(() => {
    const load = () => {
      fetchExperiments().then(res => setExperiments(res.data));
      void runAuditNow("exp-baseline");
    };
    load();
    window.addEventListener('dataset-changed', load);
    return () => window.removeEventListener('dataset-changed', load);
  }, [runAuditNow]);

  const handleStartAudit = () => runAuditNow(selectedExpId, comparisonExpId || undefined);

  const count = (s: AuditStatus) => findings.filter(f => f.status === s).length;
  const shown = findings.filter(f => statusFilter === 'ALL' || f.status === statusFilter);
  const report = audit?.report;
  const backendShown = (report?.findings || []).filter(f => statusFilter === 'ALL' || f.status === statusFilter);
  const verdict = overallStatus(findings);

  const selectClass =
    'h-7 min-w-0 max-w-[280px] bg-background border border-border rounded-md px-2 text-xs text-text cursor-pointer focus:outline-none focus:border-primary';

  const toggle = (id: string) => setExpanded(expanded === id ? null : id);
  const chevron = (open: boolean) =>
    open ? (
      <ChevronDown className="w-3.5 h-3.5 text-muted inline mr-1.5 align-[-2px]" />
    ) : (
      <ChevronRight className="w-3.5 h-3.5 text-muted inline mr-1.5 align-[-2px]" />
    );

  return (
    <Page
      title="Reproducibility audit"
      hint={wb.source ? `Workspace dataset: ${wb.source.name}` : 'No dataset loaded in the workspace'}
      actions={
        <>
          <Btn onClick={wb.exportAudit}>
            <Download className="w-3.5 h-3.5 mr-1.5 text-muted" />
            Export report
          </Btn>
          <Btn onClick={() => void wb.rerunPipeline()} disabled={reproducing} title="Runs all four pipeline stages on the backend and compares the metrics with the documented baseline">
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 text-muted ${reproducing ? 'animate-spin' : ''}`} />
            {reproducing ? 'Rerunning pipeline…' : 'Rerun pipeline and compare'}
          </Btn>
          <Btn variant="primary" onClick={handleStartAudit} disabled={auditRunning}>
            {auditRunning ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />}
            {auditRunning ? 'Auditing…' : 'Run audit'}
          </Btn>
        </>
      }
    >
      {/* Target & comparison run selector */}
      <div className="min-h-11 px-4 py-1.5 border-b border-border flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
        <label className="flex items-center gap-2 min-w-0" title="The run whose provenance and reproducibility will be verified">
          <span className="text-muted whitespace-nowrap">Target run</span>
          <select value={selectedExpId} onChange={(e) => setSelectedExpId(e.target.value)} className={selectClass}>
            {experiments.map(exp => (
              <option key={exp.id} value={exp.id}>
                {exp.name} ({exp.id}){exp.is_baseline ? ' · baseline' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 min-w-0" title="Check metric drift or configuration divergence against another run">
          <span className="text-muted whitespace-nowrap">Compare with</span>
          <select value={comparisonExpId} onChange={(e) => setComparisonExpId(e.target.value)} className={selectClass}>
            <option value="">None (baseline reference)</option>
            {experiments.filter(e => e.id !== selectedExpId).map(exp => (
              <option key={exp.id} value={exp.id}>
                {exp.name} ({exp.id})
              </option>
            ))}
          </select>
        </label>

        <span className="text-muted" title="A rerun within this distance of the baseline metrics counts as matching">
          Tolerance <span className="text-text tabular-nums">±{METRIC_TOLERANCE}</span>
        </span>

        <div className="ml-auto flex items-center rounded-md border border-border bg-background p-px">
          {FILTERS.map(filter => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              aria-pressed={statusFilter === filter}
              className={`h-6 px-2 rounded text-[11px] font-medium lowercase cursor-pointer ${
                statusFilter === filter ? 'bg-raised text-text' : 'text-muted hover:text-text'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-6">
        <Stat
          label="Workspace verdict"
          value={<Tag tone={statusTone(verdict)}>{verdict}</Tag>}
          sub="Worst result among the checks that could run"
        />
        <Stat label="Passed" value={<span className="tabular-nums">{count('PASS')}</span>} />
        <Stat label="Warnings" value={<span className="tabular-nums">{count('WARNING')}</span>} />
        <Stat label="Failures" value={<span className="tabular-nums">{count('FAIL')}</span>} />
        <Stat label="Not checked" value={<span className="tabular-nums">{count('NOT CHECKED')}</span>} sub="Information was not available" />
        <Stat
          label="Reproduction"
          value={reproduction ? <Tag tone={statusTone(findings.find(f => f.id === 'reproduction')?.status)}>{findings.find(f => f.id === 'reproduction')?.status}</Tag> : <Tag>not attempted</Tag>}
          sub={reproduction ? new Date(reproduction.at).toLocaleString() : 'No rerun in this session'}
        />
      </div>

      {/* Checks derived from the workspace and live metadata */}
      <SectionLabel count={shown.length} aside="Computed from the loaded dataset, the recorded steps and live backend metadata">
        Experiment checks
      </SectionLabel>
      <div className="overflow-x-auto">
        <table className="sheet">
          <thead>
            <tr>
              <th className="rn"></th>
              <Th>check</Th>
              <Th>what was found</Th>
              <Th>result</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f, idx) => {
              const open = expanded === f.id;
              return (
                <Fragment key={f.id}>
                  <tr className={`is-clickable ${open ? 'is-selected' : ''}`} onClick={() => toggle(f.id)}>
                    <td className="rn">{idx + 1}</td>
                    <td className="font-medium">
                      <button type="button" aria-expanded={open} className="cursor-pointer text-left">
                        {chevron(open)}
                        {f.check}
                      </button>
                    </td>
                    <td className="wrap text-xs text-muted min-w-[280px]">{f.found}</td>
                    <td><Tag tone={statusTone(f.status)}>{f.status}</Tag></td>
                  </tr>
                  {open && (
                    <tr>
                      <td className="rn"></td>
                      <td colSpan={3} className="wrap !bg-background">
                        <dl className="max-w-3xl space-y-2.5 text-xs py-1">
                          <Detail label="What was checked">{f.check}</Detail>
                          <Detail label="What was found">{f.found}</Detail>
                          <Detail label="Evidence"><span className="font-mono break-all">{f.evidence}</span></Detail>
                          <Detail label="Why it matters">{f.why}</Detail>
                          <Detail label="Recommended next action">{f.action}</Detail>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td className="rn"></td>
                <td colSpan={3} className="text-muted">No checks have this result.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reproduction logs */}
      {reproduction?.logs && reproduction.logs.length > 0 && (
        <>
          <SectionLabel count={reproduction.logs.length} aside={reproduction.runId}>Rerun output</SectionLabel>
          <div className="overflow-x-auto">
            <table className="sheet">
              <thead>
                <tr>
                  <th className="rn"></th>
                  <Th>stage</Th>
                  <Th t="#" className="num">exit code</Th>
                  <Th>output</Th>
                </tr>
              </thead>
              <tbody>
                {reproduction.logs.map((log, idx) => (
                  <tr key={log.stage}>
                    <td className="rn">{idx + 1}</td>
                    <td className="font-medium">{log.stage}</td>
                    <td className="num">{log.returncode}</td>
                    <td className="wrap font-mono text-xs">
                      {log.stdout && <p>{log.stdout}</p>}
                      {log.stderr && <p className="text-error">{log.stderr}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Findings reported by the backend audit endpoint */}
      <SectionLabel
        count={report ? backendShown.length : undefined}
        aside={
          audit ? (
            audit.isReal ? (
              <>
                <span>audit {report!.audit_id} · Python {report!.summary.python_version}</span>
                <Tag tone="green">live backend</Tag>
              </>
            ) : (
              <Tag tone="amber">demo data</Tag>
            )
          ) : undefined
        }
      >
        Pipeline audit (backend)
      </SectionLabel>
      {audit && !audit.isReal && (
        <p className="px-4 py-2 border-b border-border bg-warning/10 text-xs text-warning">
          <span className="font-semibold">DEMO DATA.</span> The backend is offline, so the rows below are a built-in sample and are not checks of your project. They are excluded from the verdict above.
        </p>
      )}
      {!audit ? (
        <p className="px-4 py-3 text-xs text-muted">{auditRunning ? 'Running the audit…' : 'Not run yet. Use Run audit.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="sheet">
            <thead>
              <tr>
                <th className="rn"></th>
                <Th>check</Th>
                <Th>category</Th>
                <Th>result</Th>
              </tr>
            </thead>
            <tbody>
              {backendShown.map((finding, idx) => {
                const id = `backend:${finding.name}`;
                const open = expanded === id;
                return (
                  <Fragment key={id}>
                    <tr className={`is-clickable ${open ? 'is-selected' : ''}`} onClick={() => toggle(id)}>
                      <td className="rn">{idx + 1}</td>
                      <td className="font-medium">
                        <button type="button" aria-expanded={open} className="cursor-pointer text-left">
                          {chevron(open)}
                          {finding.name}
                        </button>
                      </td>
                      <td className="text-muted">{finding.category}</td>
                      <td><Tag tone={statusTone(finding.status)}>{finding.status}</Tag></td>
                    </tr>
                    {open && (
                      <tr>
                        <td className="rn"></td>
                        <td colSpan={3} className="wrap !bg-background">
                          <dl className="max-w-3xl space-y-2.5 text-xs py-1">
                            <Detail label="Explanation">{finding.explanation}</Detail>
                            <Detail label="Evidence"><span className="font-mono break-all">{finding.evidence}</span></Detail>
                            {finding.action && <Detail label="Recommended next action">{finding.action}</Detail>}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {backendShown.length === 0 && (
                <tr>
                  <td className="rn"></td>
                  <td colSpan={3} className="text-muted">No backend findings have this result.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Recommendations */}
      {report && report.recommendations.length > 0 && (
        <>
          <SectionLabel count={report.recommendations.length} aside={audit!.isReal ? undefined : <Tag tone="amber">demo data</Tag>}>
            Backend recommendations
          </SectionLabel>
          <table className="sheet">
            <tbody>
              {report.recommendations.map((rec, i) => (
                <tr key={i}>
                  <td className="rn">{i + 1}</td>
                  <td className="wrap">{rec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Page>
  );
}

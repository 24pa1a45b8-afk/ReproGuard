import { useState, useEffect } from 'react';
import { Search, ArrowLeftRight, X, AlertCircle } from 'lucide-react';
import { Btn, Page, SectionLabel, Tag, Th, statusTone } from '../components/ui';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { fetchExperiments } from '../services/api';
import type { Experiment } from '../types';

export default function Experiments() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(['exp-baseline', 'exp-rf-depth12']);
  const [searchQuery, setSearchQuery] = useState('');
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const loadExperiments = () => {
    fetchExperiments().then(res => {
      setExperiments(res.data);
      if (res.data.length >= 2 && selectedIds.length === 0) {
        setSelectedIds([res.data[0].id, res.data[1].id]);
      }
    });
  };

  useEffect(() => {
    loadExperiments();
    const handler = () => loadExperiments();
    window.addEventListener('dataset-changed', handler);
    return () => window.removeEventListener('dataset-changed', handler);
  }, []);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      if (selectedIds.length < 2) {
        setSelectedIds([...selectedIds, id]);
      } else {
        setSelectedIds([selectedIds[1], id]);
      }
    }
  };

  const filteredExperiments = experiments.filter(e => 
    e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const expA = experiments.find(e => e.id === selectedIds[0]);
  const expB = experiments.find(e => e.id === selectedIds[1]);

  const chartData = (expA && expB) ? [
    {
      metric: 'Accuracy',
      [expA.name]: Number(expA.accuracy.toFixed(4)),
      [expB.name]: Number(expB.accuracy.toFixed(4)),
    },
    {
      metric: 'ROC-AUC',
      [expA.name]: Number(expA.roc_auc.toFixed(4)),
      [expB.name]: Number(expB.roc_auc.toFixed(4)),
    }
  ] : [];

  const datasetMismatch = expA && expB && expA.dataset_fingerprint !== expB.dataset_fingerprint;

  const same = <span className="text-muted">same</span>;
  const delta = (a: number, b: number) => `${b - a >= 0 ? '+' : ''}${(b - a).toFixed(4)}`;

  return (
    <Page
      title="Experiments"
      hint="Select 2 runs to compare parameters and metrics"
      actions={
        <>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search run ID, name or model"
              className="h-7 w-64 max-w-full bg-surface border border-border rounded-md pl-7 pr-2 text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>
          <Btn variant="primary" onClick={() => setShowComparisonModal(true)} disabled={selectedIds.length !== 2}>
            <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
            Compare selected ({selectedIds.length}/2)
          </Btn>
        </>
      }
    >
      {/* Comparison modal */}
      {showComparisonModal && expA && expB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-surface border border-border rounded-xl max-w-4xl w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="min-h-11 px-4 py-1.5 flex items-center justify-between gap-4 border-b border-border">
              <div className="flex items-baseline gap-3 min-w-0">
                <h2 className="text-sm font-semibold text-text whitespace-nowrap">Compare runs</h2>
                <span className="text-xs text-muted truncate">
                  <span className="text-text">{expA.name}</span> vs <span className="text-text">{expB.name}</span>
                </span>
              </div>
              <button
                onClick={() => setShowComparisonModal(false)}
                className="text-muted hover:text-text cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Incomparability warning */}
            {datasetMismatch && (
              <div className="px-4 py-2 border-b border-border bg-warning/10 text-xs text-text flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                <span>
                  These runs used different raw datasets ({expA.dataset_fingerprint.slice(0, 8)} vs {expB.dataset_fingerprint.slice(0, 8)}), so their metrics are not directly comparable.
                </span>
              </div>
            )}

            {/* Metrics chart */}
            <SectionLabel>Metrics</SectionLabel>
            <div className="h-56 w-full px-4 py-3 border-b border-border">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#A0A0A0' }} />
                  <YAxis domain={[0.7, 1.0]} tick={{ fontSize: 12, fill: '#A0A0A0' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#2A2A2A', borderColor: '#353535', color: '#F0F0F0', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey={expA.name} fill="#1685F8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={expB.name} fill="#63B982" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Differential table */}
            <SectionLabel>Parameter and provenance differences</SectionLabel>
            <div className="overflow-x-auto">
              <table className="sheet">
                <thead>
                  <tr>
                    <th className="rn"></th>
                    <Th>attribute</Th>
                    <Th>{expA.name}</Th>
                    <Th>{expB.name}</Th>
                    <Th>difference</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="rn">1</td>
                    <td className="font-medium">Dataset origin</td>
                    <td>{expA.dataset_name || (expA.is_baseline ? "Wine Quality (Baseline)" : "Custom Dataset")}</td>
                    <td>{expB.dataset_name || (expB.is_baseline ? "Wine Quality (Baseline)" : "Custom Dataset")}</td>
                    <td>
                      {expA.dataset_fingerprint === expB.dataset_fingerprint
                        ? <Tag tone="green">matched</Tag>
                        : <Tag tone="amber">different datasets</Tag>}
                    </td>
                  </tr>
                  <tr>
                    <td className="rn">2</td>
                    <td className="font-medium">Dataset hash</td>
                    <td className="font-mono text-xs">{expA.dataset_fingerprint}</td>
                    <td className="font-mono text-xs">{expB.dataset_fingerprint}</td>
                    <td>
                      {expA.dataset_fingerprint === expB.dataset_fingerprint
                        ? <Tag tone="green">identical</Tag>
                        : <Tag tone="red">diverged</Tag>}
                    </td>
                  </tr>
                  <tr>
                    <td className="rn">3</td>
                    <td className="font-medium">Model architecture</td>
                    <td>{expA.model}</td>
                    <td>{expB.model}</td>
                    <td><Tag tone="green">matched</Tag></td>
                  </tr>
                  <tr>
                    <td className="rn">4</td>
                    <td className="font-medium">Tree depth (max_depth)</td>
                    <td className="num">{expA.parameters.max_depth}</td>
                    <td className="num">{expB.parameters.max_depth}</td>
                    <td>
                      {expA.parameters.max_depth === expB.parameters.max_depth
                        ? same
                        : <Tag tone="blue">{expA.parameters.max_depth} → {expB.parameters.max_depth}</Tag>}
                    </td>
                  </tr>
                  <tr>
                    <td className="rn">5</td>
                    <td className="font-medium">Estimators (n_estimators)</td>
                    <td className="num">{expA.parameters.n_estimators}</td>
                    <td className="num">{expB.parameters.n_estimators}</td>
                    <td>
                      {expA.parameters.n_estimators === expB.parameters.n_estimators
                        ? same
                        : <Tag tone="blue">{expA.parameters.n_estimators} → {expB.parameters.n_estimators}</Tag>}
                    </td>
                  </tr>
                  <tr>
                    <td className="rn">6</td>
                    <td className="font-medium">Random seed</td>
                    <td className="num">{expA.parameters.seed ?? 'none (unpinned)'}</td>
                    <td className="num">{expB.parameters.seed ?? 'none (unpinned)'}</td>
                    <td>
                      {expA.parameters.seed === expB.parameters.seed
                        ? <Tag tone="green">preserved</Tag>
                        : <Tag tone="amber">seed divergence</Tag>}
                    </td>
                  </tr>
                  <tr>
                    <td className="rn">7</td>
                    <td className="font-medium">Accuracy</td>
                    <td className="num">{expA.accuracy.toFixed(4)}</td>
                    <td className="num">{expB.accuracy.toFixed(4)}</td>
                    <td className="tabular-nums">{delta(expA.accuracy, expB.accuracy)}</td>
                  </tr>
                  <tr>
                    <td className="rn">8</td>
                    <td className="font-medium">ROC-AUC</td>
                    <td className="num">{expA.roc_auc.toFixed(4)}</td>
                    <td className="num">{expB.roc_auc.toFixed(4)}</td>
                    <td className="tabular-nums">{delta(expA.roc_auc, expB.roc_auc)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 flex justify-end">
              <Btn variant="primary" onClick={() => setShowComparisonModal(false)}>Done</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Experiments grid */}
      <div className="overflow-x-auto">
        <table className="sheet">
          <thead>
            <tr>
              <th className="rn"></th>
              <th className="w-9"></th>
              <Th>run</Th>
              <Th>run id</Th>
              <Th>dataset</Th>
              <Th>dataset hash</Th>
              <Th>model</Th>
              <Th t="#" className="num">max_depth</Th>
              <Th t="#" className="num">n_estimators</Th>
              <Th t="#" className="num">seed</Th>
              <Th t="#" className="num">accuracy</Th>
              <Th t="#" className="num">roc_auc</Th>
              <Th>reproducibility</Th>
            </tr>
          </thead>
          <tbody>
            {filteredExperiments.map((exp, idx) => {
              const isSelected = selectedIds.includes(exp.id);
              return (
                <tr
                  key={exp.id}
                  className={`is-clickable ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => toggleSelect(exp.id)}
                >
                  <td className="rn">{idx + 1}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(exp.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${exp.name}`}
                      className="accent-primary cursor-pointer align-middle"
                    />
                  </td>
                  <td className="font-medium">
                    {exp.name}
                    {exp.is_baseline && <span className="ml-2"><Tag tone="grey">baseline</Tag></span>}
                  </td>
                  <td className="text-muted">{exp.id}</td>
                  <td>{exp.dataset_name || (exp.is_baseline ? 'Wine Quality' : 'Custom')}</td>
                  <td className="font-mono text-xs text-muted">{exp.dataset_fingerprint?.slice(0, 8)}…</td>
                  <td>{exp.model}</td>
                  <td className="num">{exp.parameters.max_depth}</td>
                  <td className="num">{exp.parameters.n_estimators}</td>
                  <td className="num">{exp.parameters.seed ?? <span className="text-muted">null</span>}</td>
                  <td className="num">{exp.accuracy.toFixed(4)}</td>
                  <td className="num">{exp.roc_auc.toFixed(4)}</td>
                  <td><Tag tone={statusTone(exp.reproducibility_status)}>{exp.reproducibility_status}</Tag></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 text-xs text-muted">
        {filteredExperiments.length} × 11
      </div>
    </Page>
  );
}

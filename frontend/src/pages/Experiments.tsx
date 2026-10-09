import { useState, useEffect } from 'react';
import { 
  Search, 
  ArrowLeftRight, 
  CheckCircle, 
  AlertTriangle, 
  X,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
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
      // Drop selections that don't exist in the loaded runs
      setSelectedIds(prev => prev.filter(id => res.data.some(e => e.id === id)));
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Experiment Comparison</h1>
          <p className="text-sm text-muted mt-1">
            Compare parameter variations, evaluation metrics, and environment reproducibility across experiment runs.
          </p>
        </div>

        <button 
          onClick={() => setShowComparisonModal(true)}
          disabled={selectedIds.length !== 2}
          className="inline-flex items-center px-4 py-2 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/90 transition-colors shadow-xs self-start md:self-auto cursor-pointer disabled:opacity-50"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
          Compare Selected ({selectedIds.length}/2)
        </button>
      </div>

      {/* Comparison Drawer / Modal */}
      {showComparisonModal && expA && expB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-lg max-w-4xl w-full p-6 shadow-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-text flex items-center">
                  <ArrowLeftRight className="w-4 h-4 text-primary mr-2" />
                  Run Differential Analysis
                </h2>
                <p className="text-xs text-muted">
                  Comparing <span className="font-semibold text-text">{expA.name}</span> vs <span className="font-semibold text-text">{expB.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setShowComparisonModal(false)}
                className="text-muted hover:text-text cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Incomparability Warning */}
            {datasetMismatch && (
              <div className="my-4 p-3 bg-warning/10 border border-warning/30 rounded text-xs text-text flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-warning block">Warning: Datasets Differ</span>
                  <span>These runs evaluated against distinct raw datasets ({expA.dataset_fingerprint.slice(0, 8)} vs {expB.dataset_fingerprint.slice(0, 8)}). Performance metrics are not directly comparable.</span>
                </div>
              </div>
            )}

            {/* Metrics Chart */}
            <div className="my-6 p-4 bg-background rounded border border-border">
              <h3 className="text-xs font-bold text-text uppercase tracking-wider mb-4 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1.5 text-primary" />
                Metric Comparison Chart
              </h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis domain={[0, 1]}tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: 6, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey={expA.name} fill="#245C49" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={expB.name} fill="#38A58A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Differential Table */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                Detailed Parameter & Provenance Differences
              </h3>
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-background border-b border-border text-[11px] uppercase font-semibold text-muted">
                    <tr>
                      <th className="p-3">Attribute</th>
                      <th className="p-3">{expA.name}</th>
                      <th className="p-3">{expB.name}</th>
                      <th className="p-3">Difference Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="p-3 font-medium text-text">Dataset Origin</td>
                      <td className="p-3 font-semibold text-text">{expA.dataset_name || (expA.is_baseline ? "Wine Quality (Baseline)" : "Custom Dataset")}</td>
                      <td className="p-3 font-semibold text-text">{expB.dataset_name || (expB.is_baseline ? "Wine Quality (Baseline)" : "Custom Dataset")}</td>
                      <td className="p-3">
                        {expA.dataset_fingerprint === expB.dataset_fingerprint ? (
                          <span className="text-primary font-semibold">Matched Dataset</span>
                        ) : (
                          <span className="text-warning font-semibold">Different Datasets</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-text">Dataset Hash</td>
                      <td className="p-3 font-mono">{expA.dataset_fingerprint}</td>
                      <td className="p-3 font-mono">{expB.dataset_fingerprint}</td>
                      <td className="p-3">
                        {expA.dataset_fingerprint === expB.dataset_fingerprint ? (
                          <span className="text-primary font-semibold">Identical</span>
                        ) : (
                          <span className="text-error font-semibold">Diverged</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-text">Model Architecture</td>
                      <td className="p-3">{expA.model}</td>
                      <td className="p-3">{expB.model}</td>
                      <td className="p-3">
                        {expA.model === expB.model ? (
                          <span className="text-primary font-semibold">Matched</span>
                        ) : (
                          <span className="text-warning font-semibold">Different</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-text">Tree Depth (max_depth)</td>
                      <td className="p-3 font-mono">{expA.parameters.max_depth}</td>
                      <td className="p-3 font-mono">{expB.parameters.max_depth}</td>
                      <td className="p-3">
                        {expA.parameters.max_depth === expB.parameters.max_depth ? (
                          <span className="text-muted">Same</span>
                        ) : (
                          <span className="text-accent font-semibold">Modified ({expA.parameters.max_depth} → {expB.parameters.max_depth})</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-text">Estimators (n_estimators)</td>
                      <td className="p-3 font-mono">{expA.parameters.n_estimators}</td>
                      <td className="p-3 font-mono">{expB.parameters.n_estimators}</td>
                      <td className="p-3">
                        {expA.parameters.n_estimators === expB.parameters.n_estimators ? (
                          <span className="text-muted">Same</span>
                        ) : (
                          <span className="text-accent font-semibold">Modified ({expA.parameters.n_estimators} → {expB.parameters.n_estimators})</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-text">Random Seed</td>
                      <td className="p-3 font-mono">{expA.parameters.seed ?? 'None (Unpinned)'}</td>
                      <td className="p-3 font-mono">{expB.parameters.seed ?? 'None (Unpinned)'}</td>
                      <td className="p-3">
                        {expA.parameters.seed === expB.parameters.seed ? (
                          <span className="text-primary font-semibold">Preserved</span>
                        ) : (
                          <span className="text-warning font-semibold">Seed Divergence</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-text">Accuracy Metric</td>
                      <td className="p-3 font-mono font-bold">{expA.accuracy.toFixed(4)}</td>
                      <td className="p-3 font-mono font-bold">{expB.accuracy.toFixed(4)}</td>
                      <td className="p-3 font-mono">
                        {(expB.accuracy - expA.accuracy) >= 0 ? '+' : ''}{(expB.accuracy - expA.accuracy).toFixed(4)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-text">ROC-AUC Metric</td>
                      <td className="p-3 font-mono font-bold">{expA.roc_auc.toFixed(4)}</td>
                      <td className="p-3 font-mono font-bold">{expB.roc_auc.toFixed(4)}</td>
                      <td className="p-3 font-mono">
                        {(expB.roc_auc - expA.roc_auc) >= 0 ? '+' : ''}{(expB.roc_auc - expA.roc_auc).toFixed(4)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border mt-4">
              <button 
                onClick={() => setShowComparisonModal(false)}
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/90 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Experiments Table Card */}
      <div className="bg-surface rounded-lg border border-border shadow-xs overflow-hidden">
        {/* Table Search & Filter Bar */}
        <div className="p-4 border-b border-border bg-background/40 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search experiments by run ID, name, or model..."
              className="w-full bg-surface border border-border rounded pl-9 pr-4 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
            />
          </div>

          <span className="text-xs text-muted font-medium">
            Select 2 runs to compare parameter & metric divergence
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background/80 border-b border-border text-[11px] uppercase font-semibold text-muted">
              <tr>
                <th className="px-4 py-3 w-10">Select</th>
                <th className="px-4 py-3">Run ID & Name</th>
                <th className="px-4 py-3">Dataset</th>
                <th className="px-4 py-3">Dataset Hash</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Key Parameters</th>
                <th className="px-4 py-3">Accuracy</th>
                <th className="px-4 py-3">ROC-AUC</th>
                <th className="px-4 py-3">Reproducibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredExperiments.map(exp => {
                const isSelected = selectedIds.includes(exp.id);
                return (
                  <tr key={exp.id} className="hover:bg-background/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(exp.id)}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-text">{exp.name}</span>
                        {exp.is_baseline && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                            Baseline
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-muted block mt-0.5">{exp.id}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-text block">
                        {exp.dataset_name || (exp.is_baseline ? 'Wine Quality' : 'Custom')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted">
                      {exp.dataset_fingerprint?.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3.5 font-medium text-text">
                      {exp.model}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted">
                      depth={exp.parameters.max_depth}, n_est={exp.parameters.n_estimators}, seed={exp.parameters.seed ?? 'null'}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-text">
                      {exp.accuracy.toFixed(4)}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-text">
                      {exp.roc_auc.toFixed(4)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                        exp.reproducibility_status === 'PASS' 
                          ? 'bg-primary/10 text-primary border border-primary/20' 
                          : 'bg-warning/10 text-warning border border-warning/20'
                      }`}>
                        {exp.reproducibility_status === 'PASS' ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                        {exp.reproducibility_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

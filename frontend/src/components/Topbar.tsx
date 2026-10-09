import { Play, CheckCircle2, RefreshCw, Database } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProject, runAudit, fetchDatasetsVault, activateDatasetInVault } from '../services/api';

export default function Topbar() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [datasetsVault, setDatasetsVault] = useState<{ active_dataset_id: string; active_dataset: any; datasets: any[] }>({
    active_dataset_id: '',
    active_dataset: null,
    datasets: []
  });
  const [switching, setSwitching] = useState(false);

  const loadAll = () => {
    fetchProject().then(res => setProjectInfo(res.data));
    fetchDatasetsVault().then(res => setDatasetsVault(res));
  };

  useEffect(() => {
    loadAll();
    // Listen for custom dataset changes
    const handler = () => loadAll();
    window.addEventListener('dataset-changed', handler);
    return () => window.removeEventListener('dataset-changed', handler);
  }, []);

  const handleDatasetChange = async (newId: string) => {
    if (!newId || newId === datasetsVault.active_dataset_id) return;
    setSwitching(true);
    try {
      await activateDatasetInVault(newId);
      loadAll();
      window.dispatchEvent(new Event('dataset-changed'));
    } catch (e) {
      console.error(e);
    } finally {
      setSwitching(false);
    }
  };

  const handleRunAudit = async () => {
    setLoading(true);
    await runAudit("exp-baseline");
    setLoading(false);
    navigate('/audit');
  };

  const activeName = datasetsVault.active_dataset?.name || projectInfo?.name || "Wine Quality";

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0 z-10">
      <div className="flex items-center space-x-4 pl-10 md:pl-0">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm text-text tracking-tight">{activeName}</span>
            <span className="text-border">•</span>
            
            {/* Global Dataset Switcher */}
            <div className="relative inline-flex items-center">
              <Database className="w-3.5 h-3.5 text-primary mr-1" />
              <select 
                value={datasetsVault.active_dataset_id} 
                onChange={(e) => handleDatasetChange(e.target.value)}
                disabled={switching}
                className="bg-transparent text-xs font-semibold text-primary cursor-pointer focus:outline-none appearance-none"
              >
                {datasetsVault.datasets.map(ds => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.rows?.toLocaleString()} rows) {ds.is_baseline ? '★ Baseline' : ''}
                  </option>
                ))}
              </select>
              {switching && <RefreshCw className="w-3 h-3 text-primary animate-spin ml-1.5" />}
            </div>
          </div>

          <div className="text-[11px] text-muted flex items-center space-x-1.5 mt-0.5">
            <span className="text-accent flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-0.5" /> Synchronized
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="text-right hidden sm:block">
          <p className="text-[11px] text-muted uppercase tracking-wider">Vault Registry</p>
          <p className="text-xs font-mono font-medium text-text">
            {datasetsVault.datasets.length} Datasets Tracked
          </p>
        </div>

        <button 
          onClick={handleRunAudit}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary/95 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 mr-2 fill-white" />
          )}
          {loading ? "Running Audit..." : "Run Audit"}
        </button>
      </div>
    </header>
  );
}

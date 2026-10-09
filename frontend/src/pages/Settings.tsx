import { useState, useEffect } from 'react';
import { Server, Sliders, RefreshCw } from 'lucide-react';
import { fetchProject, fetchBackendRepoPath } from '../services/api';

export default function Settings() {
  const [tolerance, setTolerance] = useState('0.001');
  const [dvcRemote, setDvcRemote] = useState('local://.dvcstore');
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [checking, setChecking] = useState(false);
  const [repoPath, setRepoPath] = useState<string | null>(null);

  const checkConnection = async () => {
    setChecking(true);
    const [res, path] = await Promise.all([fetchProject(), fetchBackendRepoPath()]);
    setIsBackendConnected(res.isReal);
    setRepoPath(path);
    setChecking(false);
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold text-text tracking-tight">System Settings</h1>
        <p className="text-sm text-muted mt-1">
          Configure repository links, DVC remote targets, audit tolerances, and backend connectivity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backend & Repository Connection */}
        <div className="bg-surface p-6 rounded-lg border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-bold text-text flex items-center">
              <Server className="w-4 h-4 mr-2 text-primary" />
              Audit Backend Service
            </h2>
            <button 
              onClick={checkConnection}
              disabled={checking}
              className="text-xs text-primary hover:text-primary/80 flex items-center cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${checking ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
          </div>

          <div className="p-3 rounded border border-border bg-background/50 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-text block">FastAPI Server Endpoint</span>
              <span className="text-xs font-mono text-muted">http://127.0.0.1:8000/api</span>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
              isBackendConnected ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
            }`}>
              {isBackendConnected ? 'Active (Live)' : 'Disconnected (Fallback)'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">Local Git Repository Root</label>
            <input 
              type="text" 
              readOnly 
              value={repoPath ?? 'Unknown (backend not connected)'}
              className="w-full bg-background border border-border rounded p-2 text-xs font-mono text-muted focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">DVC Storage / Remote</label>
            <input 
              type="text" 
              value={dvcRemote}
              onChange={(e) => setDvcRemote(e.target.value)}
              className="w-full bg-background border border-border rounded p-2 text-xs font-mono text-text focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Reproducibility Auditing Thresholds */}
        <div className="bg-surface p-6 rounded-lg border border-border shadow-xs space-y-4">
          <div className="pb-3 border-b border-border">
            <h2 className="text-sm font-bold text-text flex items-center">
              <Sliders className="w-4 h-4 mr-2 text-accent" />
              Metric Reproducibility Tolerance
            </h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Floating-Point Epsilon Tolerance (Accuracy / ROC-AUC)
            </label>
            <input 
              type="text" 
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              className="w-full bg-background border border-border rounded p-2 text-xs font-mono text-text focus:outline-none focus:border-primary"
            />
            <span className="text-[10px] text-muted mt-1 block">
              Discrepancies below this value during reproduction are attributed to floating-point nondeterminism and marked as PASS.
            </span>
          </div>

          <div className="pt-2">
            <div className="p-3 bg-primary/5 border border-primary/20 rounded text-xs text-text">
              <span className="font-semibold text-primary block mb-1">Audit Policy: Strict Provenance</span>
              <p className="text-muted text-[11px] leading-relaxed">
                ReproGuard flags any experiment lacking random seeds, having unpinned package versions, or differing in input dataset hash as a non-reproducible or high-risk execution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

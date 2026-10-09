import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Btn, Page, SectionLabel, Tag } from '../components/ui';
import { fetchProject } from '../services/api';

export default function Settings() {
  const [tolerance, setTolerance] = useState('0.001');
  const [dvcRemote, setDvcRemote] = useState('local://.dvcstore');
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    const res = await fetchProject();
    setIsBackendConnected(res.isReal);
    setChecking(false);
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const rowClass = 'min-h-11 px-4 py-1.5 border-b border-border flex flex-wrap items-center gap-x-4 gap-y-1';
  const labelClass = 'w-56 shrink-0 text-xs text-muted';
  const inputClass =
    'h-7 flex-1 min-w-[220px] max-w-xl bg-surface border border-border rounded-md px-2 text-xs font-mono text-text focus:outline-none focus:border-primary';

  return (
    <Page
      title="Settings"
      hint="Repository, DVC remote, audit tolerance and backend connection"
      actions={
        <Btn onClick={checkConnection} disabled={checking}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-muted ${checking ? 'animate-spin' : ''}`} />
          Test connection
        </Btn>
      }
    >
      {/* Backend & repository connection */}
      <SectionLabel>Audit backend</SectionLabel>
      <div className={rowClass}>
        <span className={labelClass}>FastAPI endpoint</span>
        <span className="text-xs font-mono text-text">http://127.0.0.1:8000/api</span>
        <Tag tone={isBackendConnected ? 'green' : 'amber'}>
          {isBackendConnected ? 'connected' : 'disconnected · fallback data'}
        </Tag>
      </div>
      <label className={rowClass}>
        <span className={labelClass}>Local Git repository root</span>
        <input
          type="text"
          readOnly
          value="c:/Users/Hp/Downloads/Hack_project/dvc-ml-pipeline-main"
          className={`${inputClass} text-muted bg-background`}
        />
      </label>
      <label className={rowClass}>
        <span className={labelClass}>DVC storage / remote</span>
        <input
          type="text"
          value={dvcRemote}
          onChange={(e) => setDvcRemote(e.target.value)}
          className={inputClass}
        />
      </label>

      {/* Reproducibility thresholds */}
      <SectionLabel>Metric tolerance</SectionLabel>
      <label className={rowClass}>
        <span className={labelClass}>Epsilon (accuracy / ROC-AUC)</span>
        <input
          type="text"
          value={tolerance}
          onChange={(e) => setTolerance(e.target.value)}
          className={inputClass}
        />
      </label>
      <p className="px-4 py-2 border-b border-border text-xs text-muted max-w-3xl">
        Differences below this value during reproduction are attributed to floating-point nondeterminism and marked as pass.
      </p>

      <SectionLabel>Audit policy</SectionLabel>
      <p className="px-4 py-2.5 text-xs text-muted max-w-3xl">
        <span className="text-text font-medium">Strict provenance.</span>{' '}
        An experiment is flagged as non-reproducible or high-risk if it lacks a random seed, has unpinned package versions, or differs in input dataset hash.
      </p>
    </Page>
  );
}

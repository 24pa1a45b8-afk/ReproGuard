import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import ApplicationMenu from './components/ApplicationMenu';
import DatasetTabs from './components/DatasetTabs';
import { HelpDialog } from './components/WorkspaceDialogs';
import Workspace from './pages/Workspace';
import Overview from './pages/Overview';
import PipelineExplorer from './pages/PipelineExplorer';
import ReproducibilityAudit from './pages/ReproducibilityAudit';
import Experiments from './pages/Experiments';
import Provenance from './pages/Provenance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { WorkbenchProvider, useWorkbench } from './workbench/store';

function Shell() {
  const wb = useWorkbench();
  const { pathname } = useLocation();
  const onWorkspace = pathname === '/workspace';
  const { undo, redo } = wb;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <ApplicationMenu />

      {!onWorkspace && pathname !== '/audit' && wb.backendLive === false && (
        <div role="status" className="shrink-0 px-4 py-1.5 bg-warning/15 border-b border-border text-xs text-warning">
          <span className="font-semibold">DEMO DATA.</span>{' '}
          The pipeline backend is offline, so this page shows built-in sample values, not your project. Start the backend to see real results.
        </div>
      )}

      <main className={`flex-1 min-h-0 bg-surface ${onWorkspace ? 'overflow-hidden' : 'overflow-auto'}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/workspace" replace />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/pipeline" element={<PipelineExplorer />} />
          <Route path="/audit" element={<ReproducibilityAudit />} />
          <Route path="/experiments" element={<Experiments />} />
          <Route path="/provenance" element={<Provenance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Routes>
      </main>

      <DatasetTabs />

      {wb.helpOpen && <HelpDialog />}

      {wb.notice && (
        <div
          role={wb.notice.kind === 'error' ? 'alert' : 'status'}
          className="fixed bottom-11 left-1/2 -translate-x-1/2 z-[60] max-w-[min(640px,92vw)] flex items-start gap-2 px-3 py-2 rounded-md bg-raised border border-border shadow-lg shadow-black/40 text-xs text-text"
        >
          {wb.notice.kind === 'error' ? (
            <AlertCircle className="w-4 h-4 text-error shrink-0" />
          ) : wb.notice.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-muted shrink-0" />
          )}
          <span className="leading-relaxed">{wb.notice.text}</span>
          <button type="button" onClick={() => wb.setNotice(null)} aria-label="Dismiss" className="text-muted hover:text-text cursor-pointer shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <WorkbenchProvider>
        <Shell />
      </WorkbenchProvider>
    </Router>
  );
}

export default App;

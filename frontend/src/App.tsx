import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Overview from './pages/Overview';
import PipelineExplorer from './pages/PipelineExplorer';
import ReproducibilityAudit from './pages/ReproducibilityAudit';
import Experiments from './pages/Experiments';
import Provenance from './pages/Provenance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/pipeline" element={<PipelineExplorer />} />
              <Route path="/audit" element={<ReproducibilityAudit />} />
              <Route path="/experiments" element={<Experiments />} />
              <Route path="/provenance" element={<Provenance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;

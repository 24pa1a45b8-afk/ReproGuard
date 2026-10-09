import { NavLink } from 'react-router-dom';
import { LayoutDashboard, GitMerge, ShieldCheck, Beaker, Network, FileText, Settings, Shield, Menu, X, CheckCircle, Wifi } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState, useEffect } from 'react';
import { fetchProject } from '../services/api';

const navItems = [
  { name: 'Overview', path: '/overview', icon: LayoutDashboard },
  { name: 'Pipeline Explorer', path: '/pipeline', icon: GitMerge },
  { name: 'Reproducibility Audit', path: '/audit', icon: ShieldCheck },
  { name: 'Experiments', path: '/experiments', icon: Beaker },
  { name: 'Provenance', path: '/provenance', icon: Network },
  { name: 'Audit Reports', path: '/reports', icon: FileText },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [projectInfo, setProjectInfo] = useState<any>(null);

  useEffect(() => {
    const load = () => fetchProject().then(res => {
      setIsBackendConnected(res.isReal);
      setProjectInfo(res.data);
    });
    load();
    window.addEventListener('dataset-changed', load);
    return () => window.removeEventListener('dataset-changed', load);
  }, []);

  const projectName = projectInfo?.name || "Active Project";

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface border-r border-border">
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center space-x-2.5">
          <div 
            className="p-1.5 bg-primary text-white rounded cursor-pointer"
            onClick={() => setDesktopCollapsed(!desktopCollapsed)}
            title="Toggle Sidebar"
          >
            <Shield className="w-5 h-5" />
          </div>
          {!desktopCollapsed && (
            <div>
              <span className="font-bold text-lg tracking-tight text-text block leading-none">ReproGuard</span>
              <span className="text-[10px] text-muted tracking-wider uppercase font-semibold">Audit Engine</span>
            </div>
          )}
        </div>
        <button 
          onClick={() => setMobileOpen(false)} 
          className="md:hidden text-muted hover:text-text p-1"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {!desktopCollapsed && (
          <div className="px-3 pb-2 text-[11px] font-semibold text-muted tracking-wider uppercase">
            Workspace
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                twMerge(
                  clsx(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted hover:bg-border/40 hover:text-text'
                  )
                )
              }
            >
              <Icon className="mr-3 flex-shrink-0 h-4.5 w-4.5" />
              {!desktopCollapsed && <span className="truncate">{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Status */}
      <div className="p-4 border-t border-border bg-background/40">
        <div className="flex flex-col space-y-1.5">
          {!desktopCollapsed && (
            <>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Target Project</span>
              <span className="text-xs font-semibold text-text truncate" title={projectName}>{projectName}</span>
            </>
          )}
          <div className={`flex items-center ${!desktopCollapsed ? 'pt-2 mt-1 border-t border-border/60' : ''}`}>
            <span className={clsx(
              "w-2 h-2 rounded-full mr-2",
              isBackendConnected ? "bg-accent" : "bg-warning"
            )}></span>
            <span className="text-xs text-muted flex items-center">
              {isBackendConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-accent mr-1 inline" />
                  {!desktopCollapsed && "Live API Connected"}
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3 text-muted mr-1 inline" />
                  {!desktopCollapsed && "Local Repository Mode"}
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <div className="md:hidden fixed top-3 left-4 z-50">
        <button 
          onClick={() => setMobileOpen(!mobileOpen)} 
          className="p-2 bg-surface border border-border rounded-md shadow-sm text-text"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-xs flex-1">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className={`${desktopCollapsed ? 'w-20' : 'w-64'} shrink-0 hidden md:flex flex-col h-full transition-all duration-300 ease-in-out`}>
        {sidebarContent}
      </div>
    </>
  );
}

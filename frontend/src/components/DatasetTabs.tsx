import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkbench } from '../workbench/store';
import type { TabId } from '../workbench/store';
import { colLetter } from '../workbench/table';

/** Bottom bar: dataset tabs on the left, live status on the right. */
export default function DatasetTabs() {
  const wb = useWorkbench();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onWorkspace = pathname === '/workspace';

  const tabs: { id: TabId; label: string }[] = [];
  if (wb.original) {
    tabs.push({ id: 'original', label: 'Original dataset' });
    tabs.push({ id: 'working', label: 'Working dataset' });
  }
  if (wb.trainAvailable) tabs.push({ id: 'train', label: 'Train set' });
  if (wb.original) tabs.push({ id: 'metadata', label: 'Experiment metadata' });

  const t = wb.viewTable;
  const sel = t && wb.selection && wb.selection.col < t.columns.length ? wb.selection : null;

  return (
    <footer className="h-8 shrink-0 bg-surface border-t border-border flex items-stretch justify-between gap-4 pl-1 pr-3 text-xs">
      <div className="flex items-stretch min-w-0 overflow-x-auto" role="tablist" aria-label="Datasets">
        {tabs.map(tab => {
          const active = onWorkspace && wb.tab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                wb.setTab(tab.id);
                if (!onWorkspace) navigate('/workspace');
              }}
              className={`px-3 whitespace-nowrap border-t-2 -mt-px cursor-pointer ${
                active ? 'border-primary text-text font-medium' : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
        {tabs.length === 0 && <span className="px-3 flex items-center text-muted">No dataset loaded</span>}
      </div>

      <div className="flex items-center gap-4 text-muted whitespace-nowrap shrink-0">
        {onWorkspace && sel && (
          <span className="tabular-nums hidden md:inline">
            {sel.row === null ? `column ${colLetter(sel.col)}` : `cell ${colLetter(sel.col)}${sel.row + 1}`}
          </span>
        )}
        {wb.source && <span className="truncate max-w-[220px] hidden lg:inline" title={wb.source.name}>{wb.source.name}</span>}
        {wb.original && (
          <span className={wb.dirty ? 'text-warning' : ''}>
            {wb.steps.length === 0
              ? 'no changes'
              : wb.dirty
                ? `${wb.steps.length} step${wb.steps.length === 1 ? '' : 's'} not exported`
                : wb.syncedAt
                  ? 'sent to pipeline'
                  : 'exported'}
          </span>
        )}
        <span className={wb.backendLive ? 'text-accent' : ''} title="Pipeline backend at 127.0.0.1:8000">
          {wb.backendLive === null ? 'backend …' : wb.backendLive ? 'backend connected' : 'backend offline'}
        </span>
        {onWorkspace && t && (
          <span className="tabular-nums text-text">
            {t.nrows.toLocaleString()} rows × {t.columns.length} columns
          </span>
        )}
      </div>
    </footer>
  );
}

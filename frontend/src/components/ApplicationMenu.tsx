import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Download, Redo2, Shield, ShieldCheck, Undo2 } from 'lucide-react';
import { useWorkbench } from '../workbench/store';
import { OPS, OP_CATEGORIES } from '../workbench/ops';
import { MenuList, divider, heading, item } from './Menu';
import type { MenuItem } from './Menu';

const PAGE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/pipeline': 'Pipeline',
  '/audit': 'Reproducibility audit',
  '/experiments': 'Experiments',
  '/provenance': 'Provenance',
  '/reports': 'Audit reports',
  '/settings': 'Settings',
};

/** Shared by the Export button here and the toolbar. */
export function useExportItems(): MenuItem[] {
  const wb = useWorkbench();
  const none = !wb.working;
  const why = 'Load a dataset first.';
  return [
    item('Working dataset (.csv)', wb.exportCsv, { disabled: none, reason: why }),
    item('Transformation history (.json)', () => void wb.exportHistory(), { disabled: none, reason: why }),
    item('Experiment metadata (.json)', () => void wb.exportMetadata(), { disabled: none, reason: why }),
    item('Audit report (.json)', wb.exportAudit, {
      disabled: !wb.audit && !wb.reproduction && none,
      reason: 'Nothing has been audited yet.',
    }),
  ];
}

export default function ApplicationMenu() {
  const wb = useWorkbench();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const exportItems = useExportItems();

  const onWorkspace = pathname === '/workspace';
  const editable = !!wb.working && wb.tab === 'working';
  const selected = editable && wb.selection ? wb.working!.columns[wb.selection.col] : undefined;
  const noData = 'Load a dataset first.';
  const needColumn = 'Select a column in the working dataset first.';

  const go = (path: string) => () => navigate(path);
  const op = (id: string, params?: Record<string, unknown>) => () => {
    navigate('/workspace');
    wb.setTab('working');
    wb.openOp(id, params);
  };
  const audit = () => {
    navigate('/audit');
    void wb.runAuditNow();
  };

  const menus: { label: string; items: MenuItem[] }[] = [
    {
      label: 'File',
      items: [
        item('Import CSV…', () => fileInput.current?.click()),
        item('Load pipeline dataset', () => {
          navigate('/workspace');
          void wb.loadFromPipeline(true);
        }),
        divider,
        heading('Export'),
        ...exportItems,
        divider,
        item('Send working dataset to pipeline', () => void wb.sendToPipeline(), { disabled: !wb.working, reason: noData }),
      ],
    },
    {
      label: 'Edit',
      items: [
        item('Undo', wb.undo, { disabled: !wb.canUndo, hint: 'Ctrl+Z', reason: 'Nothing to undo.' }),
        item('Redo', wb.redo, { disabled: !wb.canRedo, hint: 'Ctrl+Y', reason: 'Nothing to redo.' }),
        divider,
        item('Delete selected column', op('delete_column'), { disabled: !selected, reason: needColumn }),
        item('Remove all steps', wb.clearSteps, { disabled: wb.steps.length === 0, reason: 'There are no steps.' }),
      ],
    },
    {
      label: 'View',
      items: [
        item('Workspace', go('/workspace')),
        divider,
        item('Overview', go('/overview')),
        item('Pipeline', go('/pipeline')),
        item('Experiments', go('/experiments')),
        item('Provenance', go('/provenance')),
        item('Settings', go('/settings')),
        divider,
        item(wb.leftOpen ? 'Hide applied steps' : 'Show applied steps', () => wb.setLeftOpen(!wb.leftOpen), { disabled: !onWorkspace }),
        item(wb.rightOpen ? 'Hide column inspector' : 'Show column inspector', () => wb.setRightOpen(!wb.rightOpen), { disabled: !onWorkspace }),
      ],
    },
    {
      label: 'Data',
      items: [
        item('Sort ascending', op('sort_rows', selected ? { column: selected.name, direction: 'asc' } : undefined), { disabled: !editable, reason: noData }),
        item('Sort descending', op('sort_rows', selected ? { column: selected.name, direction: 'desc' } : { direction: 'desc' }), { disabled: !editable, reason: noData }),
        item('Filter rows…', op('filter_rows'), { disabled: !editable, reason: noData }),
        item('Remove duplicate rows…', op('remove_duplicates'), { disabled: !editable, reason: noData }),
        divider,
        heading('Validation'),
        item('Data quality report', () => {
          navigate('/workspace');
          wb.setQualityOpen(true);
        }, { disabled: !wb.working, reason: noData }),
        item('Inspect selected column', () => {
          navigate('/workspace');
          wb.setRightOpen(true);
        }, { disabled: !wb.viewTable, reason: noData }),
      ],
    },
    {
      label: 'Transform',
      items: OP_CATEGORIES.flatMap((cat, i) => [
        ...(i > 0 ? [divider] : []),
        heading(cat),
        ...OPS.filter(o => o.category === cat).map(o => {
          const accepts = o.fields[0]?.accept;
          const hasEligible = !accepts || !!wb.working?.columns.some(c => accepts.includes(c.type));
          return item(`${o.label}…`, op(o.id), {
            disabled: !editable || !hasEligible,
            reason: !editable ? noData : `Needs a ${accepts?.join(' or ')} column; the working dataset has none.`,
          });
        }),
      ]),
    },
    {
      label: 'Audit',
      items: [
        item('Open audit workspace', go('/audit')),
        item('Run audit', audit),
        item('Rerun pipeline and compare', () => {
          navigate('/audit');
          void wb.rerunPipeline();
        }),
        divider,
        item('Audit reports', go('/reports')),
        item('Provenance', go('/provenance')),
      ],
    },
    {
      label: 'Help',
      items: [item('About and keyboard shortcuts', () => wb.setHelpOpen(true))],
    },
  ];

  const centerTitle = onWorkspace ? wb.source?.name || 'No dataset loaded' : PAGE_TITLES[pathname] || 'ReproGuard';

  return (
    <header className="h-14 shrink-0 bg-surface border-b border-border flex items-center gap-3 px-3">
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) {
            navigate('/workspace');
            void wb.importFile(f);
          }
        }}
      />

      <button type="button" onClick={go('/workspace')} className="flex items-center gap-2 shrink-0 cursor-pointer" title="Trust every experiment. Reproduce every result.">
        <span className="w-6 h-6 rounded-[5px] bg-primary text-white flex items-center justify-center">
          <Shield className="w-3.5 h-3.5" />
        </span>
        <span className="text-sm font-semibold text-text hidden sm:block">ReproGuard</span>
      </button>

      <nav className="flex items-center" aria-label="Application menu">
        {menus.map(m => (
          <div key={m.label} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open === m.label}
              onClick={() => setOpen(open === m.label ? null : m.label)}
              onMouseEnter={() => {
                if (open && open !== m.label) setOpen(m.label);
              }}
              className={`h-7 px-2 rounded text-[13px] cursor-pointer ${open === m.label ? 'bg-raised text-text' : 'text-text/90 hover:bg-raised'}`}
            >
              {m.label}
            </button>
            {open === m.label && <MenuList items={m.items} onClose={() => setOpen(null)} />}
          </div>
        ))}
      </nav>

      <div className="flex-1 min-w-0 text-center text-[13px] font-semibold text-text truncate hidden md:block">{centerTitle}</div>
      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center border border-border rounded-md">
          <button type="button" className="tool !rounded-r-none" onClick={wb.undo} disabled={!wb.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" className="tool !rounded-l-none border-l border-border" onClick={wb.redo} disabled={!wb.canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={audit}
          disabled={wb.auditRunning}
          className="h-8 px-3 inline-flex items-center rounded-md border border-border text-[13px] font-medium text-text hover:bg-raised disabled:opacity-60 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 mr-1.5 text-muted" />
          <span className="hidden lg:inline">{wb.auditRunning ? 'Auditing…' : 'Run audit'}</span>
        </button>

        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open === 'export'}
            onClick={() => setOpen(open === 'export' ? null : 'export')}
            className="h-8 pl-3 pr-2 inline-flex items-center rounded-md bg-primary text-white text-[13px] font-semibold hover:bg-primary/90 cursor-pointer"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export
            <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-80" />
          </button>
          {open === 'export' && <MenuList items={exportItems} onClose={() => setOpen(null)} align="right" />}
        </div>
      </div>
    </header>
  );
}

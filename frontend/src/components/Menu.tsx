import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export type MenuItem =
  | { kind: 'item'; label: string; onSelect: () => void; disabled?: boolean; hint?: string; reason?: string }
  | { kind: 'heading'; label: string }
  | { kind: 'divider' };

export const item = (label: string, onSelect: () => void, opts: { disabled?: boolean; hint?: string; reason?: string } = {}): MenuItem => ({
  kind: 'item',
  label,
  onSelect,
  ...opts,
});
export const heading = (label: string): MenuItem => ({ kind: 'heading', label });
export const divider: MenuItem = { kind: 'divider' };

/** The floating list. The parent decides when it is open and where it sits. */
export function MenuList({ items, onClose, align = 'left' }: { items: MenuItem[]; onClose: () => void; align?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute top-full mt-1 z-50 min-w-[230px] max-h-[75vh] overflow-y-auto py-1 bg-raised border border-border rounded-md shadow-lg shadow-black/40 ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {items.map((it, i) => {
        if (it.kind === 'divider') return <div key={i} className="my-1 border-t border-border" />;
        if (it.kind === 'heading') return <div key={i} className="caps px-3 pt-2 pb-1 !text-[10px]">{it.label}</div>;
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            title={it.disabled ? it.reason : undefined}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
            className="w-full flex items-center justify-between gap-6 px-3 h-7 text-left text-[13px] text-text whitespace-nowrap hover:bg-primary hover:text-white disabled:text-muted/50 disabled:hover:bg-transparent disabled:cursor-default cursor-pointer"
          >
            <span>{it.label}</span>
            {it.hint && <span className="text-[11px] opacity-60">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Centered modal frame shared by the dialogs. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={e => e.stopPropagation()}
        className={`w-full ${width} max-h-[88vh] flex flex-col bg-surface border border-border rounded-lg shadow-xl shadow-black/50`}
      >
        <div className="h-10 px-4 flex items-center justify-between border-b border-border shrink-0">
          <h2 className="text-[13px] font-semibold text-text">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="tool !w-6 !h-6 text-lg leading-none">×</button>
        </div>
        <div className="overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="px-4 py-3 flex items-center justify-end gap-2 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

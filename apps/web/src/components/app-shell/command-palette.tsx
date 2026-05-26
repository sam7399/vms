'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import { cn, Kbd } from '@vms/ui';
import { useI18n } from '@/lib/i18n';
import { ALL_NAV_LEAVES } from './nav-config';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Cmd+K palette. Searches: routes (always), visitors/workers via API
 * (when backend search ships), actions (approve/blacklist/etc when RBAC
 * surfaces them). Today: routes only.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setFocused(0);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = ALL_NAV_LEAVES.map((leaf) => ({
      kind: 'route' as const,
      key: leaf.href,
      label: t(leaf.i18nKey),
      hint: leaf.href,
      onSelect: () => router.push(leaf.href),
    }));
    if (!q) return all;
    return all
      .map((item) => ({
        ...item,
        score:
          item.label.toLowerCase().startsWith(q) ? 3 :
          item.label.toLowerCase().includes(q) ? 2 :
          item.hint.toLowerCase().includes(q) ? 1 : 0,
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, t, router]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocused((f) => Math.min(items.length - 1, f + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocused((f) => Math.max(0, f - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[focused];
        if (item) {
          item.onSelect();
          onClose();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, items, focused, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 sm:pt-24 animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-surface-2 border border-border-subtle rounded-xl shadow-op-3 overflow-hidden animate-slide-up">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border-subtle">
          <Search className="w-4 h-4 text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocused(0);
            }}
            placeholder="Search routes, visitors, actions…"
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none text-sm"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-text-tertiary">No results</li>
          ) : (
            items.map((item, i) => (
              <li
                key={item.key}
                onMouseEnter={() => setFocused(i)}
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
                className={cn(
                  'flex items-center gap-2.5 px-4 h-9 cursor-pointer text-sm',
                  i === focused ? 'bg-surface-3 text-text-primary' : 'text-text-secondary',
                )}
              >
                <ArrowRight
                  className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    i === focused ? 'text-brand-400' : 'text-text-tertiary',
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                <span className="font-mono text-[10px] text-text-tertiary">{item.hint}</span>
              </li>
            ))
          )}
        </ul>
        <footer className="px-4 h-9 flex items-center justify-end gap-3 border-t border-border-subtle text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
        </footer>
      </div>
    </div>
  );
}

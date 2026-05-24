'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, Users, HardHat, Building2, BarChart3, BookOpen, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Item {
  href: string;
  key: string;
}
interface Category {
  key: string;
  icon: any;
  items: Item[];
}

const CATEGORIES: Category[] = [
  {
    key: 'nav.visitors',
    icon: Users,
    items: [
      { href: '/check-in', key: 'nav.checkIn' },
      { href: '/visitors-list', key: 'nav.visitorsDirectory' },
      { href: '/approvals', key: 'nav.approvals' },
    ],
  },
  {
    key: 'nav.workforce',
    icon: HardHat,
    items: [
      { href: '/contractors', key: 'nav.contractors' },
      { href: '/workers', key: 'nav.workers' },
      { href: '/shifts', key: 'nav.shifts' },
    ],
  },
  {
    key: 'nav.operations',
    icon: Building2,
    items: [
      { href: '/parking', key: 'nav.parking' },
      { href: '/vehicles', key: 'nav.vehicles' },
      { href: '/material-pass', key: 'nav.materials' },
    ],
  },
  {
    key: 'nav.insights',
    icon: BarChart3,
    items: [
      { href: '/reports', key: 'nav.reports' },
      { href: '/audit', key: 'nav.audit' },
    ],
  },
  {
    key: 'nav.admin',
    icon: ShieldCheck,
    items: [
      { href: '/admin/users', key: 'nav.users' },
      { href: '/admin/branches', key: 'nav.branches' },
      { href: '/about', key: 'nav.about' },
    ],
  },
];

export function NavMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close any open dropdown when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <nav
      ref={rootRef}
      className="flex items-center gap-1 -mx-6 px-6 mt-3 pt-3 border-t border-white/[0.06] flex-wrap relative"
    >
      <Link
        href="/"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06]"
      >
        <LayoutDashboard className="w-4 h-4 text-brand-400" /> {t('nav.dashboard')}
      </Link>

      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isOpen = open === cat.key;
        return (
          <div key={cat.key} className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(isOpen ? null : cat.key);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isOpen
                  ? 'bg-brand-500/15 text-white ring-1 ring-brand-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Icon className="w-4 h-4 text-brand-400" />
              {t(cat.key)}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isOpen && (
              <div className="absolute top-full left-0 mt-1.5 min-w-[230px] rounded-xl border border-white/[0.08] bg-surface-900/95 backdrop-blur-xl shadow-2xl shadow-brand-500/10 py-2 z-50 overflow-hidden">
                <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/[0.04] mb-1">
                  {t(cat.key)}
                </div>
                {cat.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(null)}
                    className="block px-4 py-2 text-sm text-zinc-300 hover:bg-brand-500/10 hover:text-white"
                  >
                    {t(it.key)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Link
        href="/help"
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06]"
      >
        <BookOpen className="w-4 h-4" /> {t('nav.help')}
      </Link>
      <Link
        href="/settings"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06]"
      >
        <SettingsIcon className="w-4 h-4" /> {t('nav.settings')}
      </Link>
    </nav>
  );
}

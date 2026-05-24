'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { LogOut, User, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { NavMenu } from '@/components/nav-menu';
import { Logo } from '@/components/logo';

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-surface-950/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          <Logo />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <button
                onClick={() => setLang('en')}
                className={`px-2 text-xs font-medium ${
                  lang === 'en' ? 'text-brand-400' : 'text-zinc-500 hover:text-white'
                }`}
                title="English"
              >
                EN
              </button>
              <span className="text-zinc-700">·</span>
              <button
                onClick={() => setLang('hi')}
                className={`px-2 text-xs font-medium ${
                  lang === 'hi' ? 'text-brand-400' : 'text-zinc-500 hover:text-white'
                }`}
                title="हिन्दी"
              >
                हि
              </button>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white leading-tight">{user.fullName}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{user.role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center shadow-brand-glow">
              <User className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-red-500/15 hover:text-red-300 text-zinc-400 transition-colors text-sm font-medium"
              title={t('nav.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <NavMenu />
      </div>
    </header>
  );
}

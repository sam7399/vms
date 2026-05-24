'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { LogOut, User, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { NavMenu } from '@/components/nav-menu';

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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between gap-8 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">VMS</h1>
            <p className="text-sm text-zinc-400">{t('topbar.subtitle')}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              <button
                onClick={() => setLang('en')}
                className={`px-2 text-xs font-medium ${lang === 'en' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
                title="English"
              >
                EN
              </button>
              <span className="text-zinc-700">·</span>
              <button
                onClick={() => setLang('hi')}
                className={`px-2 text-xs font-medium ${lang === 'hi' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
                title="हिन्दी"
              >
                हि
              </button>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-white">{user.fullName}</p>
              <p className="text-xs text-zinc-400">{user.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <button
              onClick={handleLogout}
              className="ml-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" /> {t('nav.logout')}
            </button>
          </div>
        </div>

        <NavMenu />
      </div>
    </header>
  );
}

'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import Link from 'next/link';

export function DashboardHeader() {
  const { user, logout } = useAuth();
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
            <h1 className="text-2xl font-bold text-white">VMS Dashboard</h1>
            <p className="text-sm text-zinc-400">Enterprise Visitor Management</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{user.fullName}</p>
              <p className="text-xs text-zinc-400">{user.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <button
              onClick={handleLogout}
              className="ml-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-2 -mx-6 px-6 pt-4 border-t border-white/10">
          <Link
            href="/"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/check-in"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Check-In
          </Link>
          <Link
            href="/visitors-list"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Visitors
          </Link>
          <Link
            href="/contractors"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Contractors
          </Link>
          <Link
            href="/workers"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Workers
          </Link>
          <Link
            href="/vehicles"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Vehicles
          </Link>
          <Link
            href="/approvals"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Approvals
          </Link>
          <Link
            href="/reports"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Reports
          </Link>
          <Link
            href="/audit"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Audit
          </Link>
          <Link
            href="/settings"
            className="px-4 py-2 rounded-t-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-auto"
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}

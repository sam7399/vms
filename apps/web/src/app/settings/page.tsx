'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { User, Building2, Lock, Server, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { apiGet, apiPut, API_URL } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Me {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId: string;
  branch: { id: string; name: string; location: string };
  createdAt: string;
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiGet<Me>('/auth/me')
      .then(setMe)
      .catch((e) => setMeError(e instanceof Error ? e.message : 'Failed'));
  }, [isAuthenticated]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);
    if (next !== confirm) {
      setPwError("New passwords don't match");
      return;
    }
    if (next.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    setPwBusy(true);
    try {
      await apiPut('/auth/password', { currentPassword: current, newPassword: next });
      setPwOk(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Change failed');
    } finally {
      setPwBusy(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading…</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{t('settings.title')}</h2>
          <p className="text-zinc-400">{t('settings.subtitle')}</p>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Profile</h3>
          </div>
          {meError && (
            <p className="text-sm text-red-300 mb-3">Failed to load profile: {meError}</p>
          )}
          {!me && !meError && <p className="text-sm text-zinc-500">Loading…</p>}
          {me && (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Full name" value={me.fullName} />
              <Field label="Email" value={me.email} mono />
              <Field
                label="Role"
                value={
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono text-xs">
                    {me.role}
                  </span>
                }
              />
              <Field
                label="Branch"
                value={
                  <>
                    <Building2 className="inline w-3 h-3 mr-1" />
                    {me.branch.name} — {me.branch.location}
                  </>
                }
              />
              <Field label="User ID" value={me.id} mono />
              <Field
                label="Member since"
                value={new Date(me.createdAt).toLocaleDateString()}
              />
            </dl>
          )}
        </div>

        {/* Password change */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Change password</h3>
          </div>
          <form onSubmit={changePassword} className="space-y-3 max-w-md">
            <input
              type="password"
              placeholder="Current password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="New password (min 6)"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {pwError && (
              <p className="text-sm text-red-300">{pwError}</p>
            )}
            {pwOk && (
              <p className="text-sm text-green-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Password updated.
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={pwBusy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {pwBusy ? 'Updating…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push('/auth/login');
                }}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                Sign out
              </button>
            </div>
          </form>
        </div>

        {/* System info */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">System</h3>
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="API URL" value={API_URL} mono />
            <Field
              label="Security"
              value={
                <>
                  <ShieldCheck className="inline w-3 h-3 mr-1 text-green-400" />
                  JWT auth, RBAC, rate-limited (10/s)
                </>
              }
            />
          </dl>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 uppercase mb-1">{label}</dt>
      <dd className={`text-zinc-100 ${mono ? 'font-mono text-sm break-all' : ''}`}>{value}</dd>
    </div>
  );
}

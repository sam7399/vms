'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Search, ShieldX, ShieldCheck, Users, Download } from 'lucide-react';
import { apiGet, apiPut } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { FaceEnrollButton } from '@/components/face-enroll-button';

interface Visitor {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  company: string | null;
  documentType: string;
  documentNumber: string;
  isBlacklisted: boolean;
  createdAt: string;
  _count: { visits: number };
}

export default function VisitorsListPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [visitors, setVisitors] = useState<Visitor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'blacklisted'>('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      setVisitors(await apiGet<Visitor[]>('/admin/visitors'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visitors');
    }
  }

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  async function toggleBlacklist(v: Visitor) {
    setBusyId(v.id);
    setError(null);
    try {
      await apiPut(`/admin/visitors/${v.id}/blacklist`, { blacklist: !v.isBlacklisted });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!visitors) return [];
    const q = search.trim().toLowerCase();
    return visitors.filter((v) => {
      if (filter === 'active' && v.isBlacklisted) return false;
      if (filter === 'blacklisted' && !v.isBlacklisted) return false;
      if (!q) return true;
      return (
        v.fullName.toLowerCase().includes(q) ||
        v.phone.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.company && v.company.toLowerCase().includes(q)) ||
        v.documentNumber.toLowerCase().includes(q)
      );
    });
  }, [visitors, search, filter]);

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

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Users className="w-7 h-7 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">Visitors</h2>
              {visitors && (
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-sm">
                  {visitors.length}
                </span>
              )}
            </div>
            <p className="text-zinc-400 mt-2">
              Master visitor directory. Search, blacklist, audit visit history.
            </p>
          </div>
          {filtered.length > 0 && (
            <button
              onClick={() =>
                downloadCSV(
                  `vms-visitors-${new Date().toISOString().slice(0, 10)}.csv`,
                  filtered as any,
                )
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, company, document…"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
            {(['all', 'active', 'blacklisted'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                  filter === opt
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          {!visitors && <div className="p-6 text-zinc-500">Loading…</div>}
          {visitors && filtered.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">
              {search || filter !== 'all'
                ? 'No visitors match the current filter.'
                : 'No visitors yet. Create one via the check-in or kiosk.'}
            </div>
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-400 uppercase border-b border-white/10">
                  <tr>
                    <th className="text-left p-4">Visitor</th>
                    <th className="text-left p-4">Company</th>
                    <th className="text-left p-4">Document</th>
                    <th className="text-left p-4">Visits</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((v) => (
                    <tr
                      key={v.id}
                      className={`hover:bg-white/5 ${v.isBlacklisted ? 'bg-red-500/5' : ''}`}
                    >
                      <td className="p-4">
                        <p className="font-medium text-white">{v.fullName}</p>
                        <p className="text-xs text-zinc-500">
                          {v.phone} {v.email && `· ${v.email}`}
                        </p>
                      </td>
                      <td className="p-4 text-zinc-300">{v.company ?? '—'}</td>
                      <td className="p-4">
                        <p className="text-xs text-zinc-400">{v.documentType}</p>
                        <p className="text-xs font-mono text-zinc-300">{v.documentNumber}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-300 text-xs font-medium">
                          {v._count.visits}
                        </span>
                      </td>
                      <td className="p-4">
                        {v.isBlacklisted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/15 text-red-300 text-xs">
                            <ShieldX className="w-3 h-3" /> Blacklisted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-300 text-xs">
                            <ShieldCheck className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <FaceEnrollButton kind="visitor" id={v.id} label="Face" />
                          <button
                            onClick={() => toggleBlacklist(v)}
                            disabled={busyId === v.id}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                              v.isBlacklisted
                                ? 'bg-green-600/80 hover:bg-green-600 text-white'
                                : 'bg-red-600/80 hover:bg-red-600 text-white'
                            }`}
                          >
                            {v.isBlacklisted ? 'Un-blacklist' : 'Blacklist'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

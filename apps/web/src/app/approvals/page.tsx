'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { CheckCircle, XCircle, Hourglass, Building2, User, Car } from 'lucide-react';
import { apiGet, apiPut } from '@/lib/api';

interface PendingVisit {
  id: string;
  purpose: string;
  expectedEntry: string;
  vehicleNumber: string | null;
  qrCodeToken: string;
  visitor: { fullName: string; phone: string; company: string | null };
  host: { fullName: string; email: string };
  branch: { name: string; location: string };
}

export default function ApprovalsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<PendingVisit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function load() {
    try {
      setPending(await apiGet<PendingVisit[]>('/visitors/pending'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pending visits');
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      load();
      const t = setInterval(load, 10_000);
      return () => clearInterval(t);
    }
  }, [isAuthenticated]);

  async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
    setBusyId(id);
    setError(null);
    try {
      await apiPut(`/visitors/visit/${id}/status`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update visit');
    } finally {
      setBusyId(null);
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

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Hourglass className="w-7 h-7 text-yellow-400" />
            <h2 className="text-3xl font-bold text-white">Pending Approvals</h2>
            {pending && (
              <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-sm font-medium">
                {pending.length}
              </span>
            )}
          </div>
          <p className="text-zinc-400 mt-2">
            Visits waiting on host approval. Auto-refreshes every 10 s.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {!pending && <p className="text-zinc-500">Loading…</p>}

        {pending && pending.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-zinc-300">No pending approvals — you're all caught up.</p>
          </div>
        )}

        <div className="space-y-4">
          {pending?.map((v) => (
            <div
              key={v.id}
              className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6 backdrop-blur-xl"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div>
                  <p className="text-xs text-zinc-400 uppercase mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Visitor
                  </p>
                  <p className="font-semibold text-white">{v.visitor.fullName}</p>
                  <p className="text-xs text-zinc-400">{v.visitor.phone}</p>
                  {v.visitor.company && (
                    <p className="text-xs text-zinc-400">{v.visitor.company}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase mb-1">Host</p>
                  <p className="font-semibold text-white">{v.host.fullName}</p>
                  <p className="text-xs text-zinc-400">{v.host.email}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Branch
                  </p>
                  <p className="font-semibold text-white">{v.branch.name}</p>
                  <p className="text-xs text-zinc-400">{v.branch.location}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm mb-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Purpose</p>
                  <p className="text-zinc-300">{v.purpose}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Expected</p>
                  <p className="text-zinc-300">
                    {new Date(v.expectedEntry).toLocaleString()}
                  </p>
                </div>
                {v.vehicleNumber && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      <Car className="w-3 h-3" /> Vehicle
                    </p>
                    <p className="text-zinc-300 font-mono">{v.vehicleNumber}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t border-white/10 pt-4">
                <button
                  onClick={() => decide(v.id, 'APPROVED')}
                  disabled={busyId === v.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => decide(v.id, 'REJECTED')}
                  disabled={busyId === v.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <span className="ml-auto text-xs text-zinc-500 self-center font-mono">
                  {v.qrCodeToken}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

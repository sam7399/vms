'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { QrCode, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';

interface Branch { id: string; name: string; location: string }
interface Host { id: string; fullName: string; email: string; role: string; branchId: string }
interface Visitor { id: string; fullName: string; phone: string }

interface VisitResponse {
  id: string;
  qrCodeToken: string;
  status: string;
}

interface VisitorResponse {
  id: string;
}

export default function CheckInPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);

  const [form, setForm] = useState({
    visitorName: '',
    visitorPhone: '',
    visitorEmail: '',
    visitorCompany: '',
    documentType: 'AADHAAR',
    documentNumber: '',
    purpose: '',
    branchId: '',
    hostId: '',
    vehicleNumber: '',
    expectedEntry: '',
  });

  const [qrToken, setQrToken] = useState<string | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      apiGet<Branch[]>('/admin/branches'),
      apiGet<Host[]>('/admin/hosts'),
    ])
      .then(([bs, hs]) => {
        setBranches(bs);
        setHosts(hs);
        if (bs.length === 1) setForm((f) => ({ ...f, branchId: bs[0].id }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load form data'));
  }, [isAuthenticated]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setQrToken(null);
    try {
      const visitor = await apiPost<VisitorResponse>('/visitors', {
        fullName: form.visitorName,
        phone: form.visitorPhone,
        email: form.visitorEmail || undefined,
        company: form.visitorCompany || undefined,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
      });

      const visit = await apiPost<VisitResponse>('/visitors/visit', {
        visitorId: visitor.id,
        branchId: form.branchId,
        hostId: form.hostId,
        purpose: form.purpose,
        expectedEntry: form.expectedEntry || new Date().toISOString(),
        vehicleNumber: form.vehicleNumber || undefined,
      });

      setQrToken(visit.qrCodeToken);
      setVisitId(visit.id);
      setForm({
        ...form,
        visitorName: '',
        visitorPhone: '',
        visitorEmail: '',
        visitorCompany: '',
        documentNumber: '',
        purpose: '',
        vehicleNumber: '',
        expectedEntry: '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create visit');
    } finally {
      setSubmitting(false);
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

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Pre-Register Visit</h2>
          <p className="text-zinc-400">
            Create a visitor + visit and get a QR token to share for gate check-in
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-4"
          >
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Visitor name *</label>
              <input
                type="text"
                required
                value={form.visitorName}
                onChange={(e) => set('visitorName', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Phone *</label>
                <input
                  type="tel"
                  required
                  value={form.visitorPhone}
                  onChange={(e) => set('visitorPhone', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  value={form.visitorEmail}
                  onChange={(e) => set('visitorEmail', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Company</label>
                <input
                  type="text"
                  value={form.visitorCompany}
                  onChange={(e) => set('visitorCompany', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Vehicle number</label>
                <input
                  type="text"
                  value={form.vehicleNumber}
                  onChange={(e) => set('vehicleNumber', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Document type</label>
                <select
                  value={form.documentType}
                  onChange={(e) => set('documentType', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AADHAAR">Aadhaar</option>
                  <option value="PAN">PAN</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driving Licence</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Document number *</label>
                <input
                  type="text"
                  required
                  value={form.documentNumber}
                  onChange={(e) => set('documentNumber', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Purpose *</label>
              <textarea
                required
                rows={2}
                value={form.purpose}
                onChange={(e) => set('purpose', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Branch *</label>
                <select
                  required
                  value={form.branchId}
                  onChange={(e) => set('branchId', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Branch --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.location}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Host *</label>
                <select
                  required
                  value={form.hostId}
                  onChange={(e) => set('hostId', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Host --</option>
                  {hosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.fullName} ({h.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Expected entry</label>
              <input
                type="datetime-local"
                value={form.expectedEntry}
                onChange={(e) => set('expectedEntry', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating visit…' : 'Create Visit + Generate QR'}
            </button>
          </form>

          <div>
            {qrToken ? (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-8 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                  <h3 className="text-2xl font-bold text-white">Visit created</h3>
                </div>
                <div className="bg-white aspect-square rounded-lg flex items-center justify-center mb-4">
                  <QrCode className="w-40 h-40 text-slate-900" />
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-mono text-blue-100 break-all">{qrToken}</p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(qrToken)}
                    className="p-2 rounded hover:bg-blue-500/20 text-blue-300"
                    title="Copy token"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-400 mt-3">
                  Share this token with the visitor — they enter it at the kiosk or in the mobile app.
                  Visit ID: <span className="font-mono">{visitId}</span>
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl h-full flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-16 h-16 text-zinc-400 mb-4" />
                <p className="text-zinc-400">
                  Fill out the form and submit to create a visit and get a QR token.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

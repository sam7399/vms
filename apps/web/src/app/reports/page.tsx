'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { downloadPDF } from '@/lib/pdf';

type ReportKey = 'visits' | 'attendance' | 'compliance' | 'contractors' | 'workers' | 'workerHours';

const REPORTS: { key: ReportKey; label: string; description: string; endpoint: string; flatten: (rows: any[]) => any[] }[] = [
  {
    key: 'visits',
    label: 'Visit log',
    description: 'Every visit ever recorded with visitor + host + status',
    endpoint: '/visitors/visits',
    flatten: (rows) =>
      rows.map((v) => ({
        visitId: v.id,
        visitorName: v.visitor?.fullName,
        visitorPhone: v.visitor?.phone,
        visitorCompany: v.visitor?.company,
        hostName: v.host?.fullName,
        hostEmail: v.host?.email,
        status: v.status,
        purpose: v.purpose,
        expectedEntry: v.expectedEntry,
        actualEntry: v.actualEntry,
        actualExit: v.actualExit,
        vehicleNumber: v.vehicleNumber,
        qrCodeToken: v.qrCodeToken,
        createdAt: v.createdAt,
      })),
  },
  {
    key: 'attendance',
    label: 'Worker attendance',
    description: 'Worker gate entries/exits over time',
    endpoint: '/admin/attendance',
    flatten: (rows) =>
      rows.map((a) => ({
        attendanceId: a.id,
        workerName: a.worker?.fullName,
        skillCategory: a.worker?.skillCategory,
        gateId: a.gateId,
        branchId: a.branchId,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
      })),
  },
  {
    key: 'compliance',
    label: 'Compliance status',
    description: 'Per-contractor compliance score summary',
    endpoint: '/compliance',
    flatten: (rows) =>
      rows.map((c) => ({
        contractorId: c.contractorId,
        companyName: c.companyName,
        totalWorkers: c.totalWorkers,
        compliantWorkers: c.compliantWorkers,
        complianceScore: c.complianceScore,
        status: c.status,
      })),
  },
  {
    key: 'contractors',
    label: 'Contractor directory',
    description: 'All registered contractor companies',
    endpoint: '/admin/contractors',
    flatten: (rows) =>
      rows.map((c) => ({
        contractorId: c.id,
        companyName: c.companyName,
        gstNumber: c.gstNumber,
        complianceScore: c.complianceScore,
        workersCount: c._count?.workers,
        createdAt: c.createdAt,
      })),
  },
  {
    key: 'workers',
    label: 'Worker directory',
    description: 'All workers with contractor + compliance fields',
    endpoint: '/admin/workers',
    flatten: (rows) =>
      rows.map((w) => ({
        workerId: w.id,
        fullName: w.fullName,
        phone: w.phone,
        contractor: w.contractor?.companyName,
        skillCategory: w.skillCategory,
        documentType: w.documentType,
        documentNumber: w.documentNumber,
        medicalExpiry: w.medicalExpiry,
        policeVerified: w.policeVerified,
        isActive: w.isActive,
        pfNumber: w.pfNumber,
        esicNumber: w.esicNumber,
        hourlyRate: w.hourlyRate,
      })),
  },
  {
    key: 'workerHours',
    label: 'Worker hours & overtime',
    description: 'Per-worker total hours, overtime (>8h/day), estimated pay (7d)',
    endpoint: '/admin/worker-hours?days=7',
    flatten: (raw: any) =>
      (raw?.rows ?? raw)?.map((r: any) => ({
        workerId: r.workerId,
        fullName: r.fullName,
        contractor: r.contractor,
        skillCategory: r.skillCategory,
        pfNumber: r.pfNumber,
        esicNumber: r.esicNumber,
        hourlyRate: r.hourlyRate,
        daysWorked: r.daysWorked,
        totalHours: r.totalHours,
        overtimeHours: r.overtimeHours,
        estimatedPay: r.estimatedPay,
      })) ?? [],
  },
];

export default function ReportsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [previews, setPreviews] = useState<Record<ReportKey, any[] | null>>({
    visits: null, attendance: null, compliance: null, contractors: null, workers: null, workerHours: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<ReportKey | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  async function loadReport(r: typeof REPORTS[number]) {
    setLoadingKey(r.key);
    setError(null);
    try {
      const data = await apiGet<any[]>(r.endpoint);
      const rows = r.flatten(data);
      setPreviews((p) => ({ ...p, [r.key]: rows }));
      return rows;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
      return null;
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleExport(r: typeof REPORTS[number], fmt: 'csv' | 'pdf') {
    const cached = previews[r.key];
    const rows = cached ?? (await loadReport(r));
    if (!rows || rows.length === 0) {
      setError('No data to export.');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    if (fmt === 'csv') {
      downloadCSV(`vms-${r.key}-${date}.csv`, rows);
    } else {
      downloadPDF(`vms-${r.key}-${date}.pdf`, r.label, rows);
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
          <h2 className="text-3xl font-bold text-white mb-2">Reports</h2>
          <p className="text-zinc-400">Pull live data from the API and download as CSV</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {REPORTS.map((r) => {
            const rows = previews[r.key];
            return (
              <div
                key={r.key}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between gap-4 p-6 flex-wrap">
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-semibold text-white">{r.label}</h3>
                      <p className="text-sm text-zinc-400">{r.description}</p>
                      {rows && (
                        <p className="text-xs text-zinc-500 mt-1">{rows.length} rows loaded</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadReport(r)}
                      disabled={loadingKey === r.key}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {loadingKey === r.key ? 'Loading…' : 'Preview'}
                    </button>
                    <button
                      onClick={() => handleExport(r, 'csv')}
                      disabled={loadingKey === r.key}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" /> CSV
                    </button>
                    <button
                      onClick={() => handleExport(r, 'pdf')}
                      disabled={loadingKey === r.key}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4" /> PDF
                    </button>
                  </div>
                </div>

                {rows && rows.length > 0 && (
                  <div className="border-t border-white/10 max-h-72 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="text-zinc-400 sticky top-0 bg-slate-900/80 backdrop-blur">
                        <tr>
                          {Object.keys(rows[0]).map((h) => (
                            <th key={h} className="text-left px-4 py-2 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-300">
                        {rows.slice(0, 25).map((row, i) => (
                          <tr key={i}>
                            {Object.keys(rows[0]).map((h) => (
                              <td key={h} className="px-4 py-2 whitespace-nowrap">
                                {row[h] === null || row[h] === undefined
                                  ? '—'
                                  : String(row[h])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 25 && (
                      <p className="text-xs text-zinc-500 p-3 text-center">
                        Showing first 25 of {rows.length} rows — full dataset in CSV export.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

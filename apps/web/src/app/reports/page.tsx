'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import {
  Download,
  FileText,
  FileSpreadsheet,
  BarChart3,
  Users,
  HardHat,
  Building2,
  UserCog,
  Package,
  CalendarRange,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { downloadPDF } from '@/lib/pdf';
import { downloadXLSX } from '@/lib/xlsx';
import { ReportChart, type Series } from '@/components/reports/ReportChart';
import { SchedulesPanel } from '@/components/reports/SchedulesPanel';

// ───────────────────────────────────────────────────────────────────
// Date-range presets
// ───────────────────────────────────────────────────────────────────
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function buildPresets() {
  const now = new Date();
  const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const lastMonthStart = startOfMonth(lastMonthEnd);
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  return [
    { key: 'thisMonth', label: 'This month', from: iso(startOfMonth(now)), to: iso(now) },
    { key: 'lastMonth', label: 'Last month', from: iso(lastMonthStart), to: iso(lastMonthEnd) },
    { key: '7d', label: 'Last 7 days', from: iso(daysAgo(7)), to: iso(now) },
    { key: '30d', label: 'Last 30 days', from: iso(daysAgo(30)), to: iso(now) },
    { key: '90d', label: 'Last 90 days', from: iso(daysAgo(90)), to: iso(now) },
    { key: 'ytd', label: 'This year', from: iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to: iso(now) },
  ];
}

// ───────────────────────────────────────────────────────────────────
// Report catalogue
// ───────────────────────────────────────────────────────────────────
interface GroupOpt { value: string; label: string }
interface ReportDef {
  key: string;
  label: string;
  description: string;
  endpoint: string;
  icon: typeof BarChart3;
  /** column the grouped rows are keyed by (for chart x-axis + drill-down). */
  labelKey: string;
  groupBy?: GroupOpt[];
  /** fixed drill-down dimension for reports without a groupBy selector. */
  fixedDetailGroupBy?: string;
  useBranch?: boolean;
  useContractor?: boolean;
  /** chart series; values may differ per row but keys are stable. */
  series: Series[];
}

const TIME_GROUPS: GroupOpt[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'week', label: 'Weekly' },
  { value: 'day', label: 'Daily' },
  { value: 'year', label: 'Yearly' },
];

const REPORTS: ReportDef[] = [
  {
    key: 'visits',
    label: 'Visits',
    description: 'Visit volume, status mix, unique visitors and dwell time.',
    endpoint: '/reports/visits',
    icon: Users,
    labelKey: 'group',
    useBranch: true,
    series: [
      { key: 'total', label: 'Total', color: 'rgba(59,130,246,0.7)' },
      { key: 'checkedIn', label: 'Checked in', color: '#22c55e' },
      { key: 'rejected', label: 'Rejected', color: '#f43f5e' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'By branch / location' },
      { value: 'host', label: 'By host' },
      { value: 'status', label: 'By status' },
      { value: 'company', label: 'By visitor company' },
      { value: 'purpose', label: 'By purpose' },
    ],
  },
  {
    key: 'workforce',
    label: 'Workforce hours',
    description: 'Attendance, hours, overtime and estimated pay.',
    endpoint: '/reports/workforce',
    icon: HardHat,
    labelKey: 'group',
    useBranch: true,
    useContractor: true,
    series: [
      { key: 'totalHours', label: 'Total hours', color: 'rgba(59,130,246,0.7)' },
      { key: 'overtimeHours', label: 'Overtime', color: '#f59e0b' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'contractor', label: 'By contractor' },
      { value: 'worker', label: 'By worker' },
      { value: 'branch', label: 'By branch / location' },
      { value: 'skill', label: 'By skill category' },
    ],
  },
  {
    key: 'contractors',
    label: 'Contractors',
    description: 'Per-contractor compliance, headcount, hours and pay.',
    endpoint: '/reports/contractors',
    icon: Building2,
    labelKey: 'contractor',
    fixedDetailGroupBy: 'contractor',
    series: [
      { key: 'totalWorkers', label: 'Workers', color: 'rgba(59,130,246,0.7)' },
      { key: 'workersOnSite', label: 'On site', color: '#22c55e' },
      { key: 'complianceScore', label: 'Compliance', color: '#a855f7' },
    ],
  },
  {
    key: 'branches',
    label: 'Branches / locations',
    description: 'Per-location footfall, occupancy and worker hours.',
    endpoint: '/reports/branches',
    icon: Building2,
    labelKey: 'branch',
    fixedDetailGroupBy: 'branch',
    series: [
      { key: 'visits', label: 'Visits', color: 'rgba(59,130,246,0.7)' },
      { key: 'uniqueVisitors', label: 'Unique visitors', color: '#22c55e' },
      { key: 'workersOnSite', label: 'Workers', color: '#f59e0b' },
    ],
  },
  {
    key: 'users',
    label: 'Hosts / users',
    description: 'Visits hosted per employee with approval outcomes.',
    endpoint: '/reports/users',
    icon: UserCog,
    labelKey: 'host',
    fixedDetailGroupBy: 'host',
    useBranch: true,
    series: [
      { key: 'total', label: 'Hosted', color: 'rgba(59,130,246,0.7)' },
      { key: 'checkedIn', label: 'Checked in', color: '#22c55e' },
      { key: 'rejected', label: 'Rejected', color: '#f43f5e' },
    ],
  },
  {
    key: 'materials',
    label: 'Material movement',
    description: 'Inbound / outbound gate-pass quantities.',
    endpoint: '/reports/materials',
    icon: Package,
    labelKey: 'group',
    useBranch: true,
    series: [
      { key: 'inQty', label: 'In', color: '#22c55e' },
      { key: 'outQty', label: 'Out', color: '#f43f5e' },
    ],
    groupBy: [
      ...TIME_GROUPS,
      { value: 'branch', label: 'By branch / location' },
      { value: 'direction', label: 'By direction' },
    ],
  },
];

interface Branch { id: string; name: string; location: string }
interface Contractor { id: string; companyName: string }

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export default function ReportsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const presets = useMemo(buildPresets, []);
  const [from, setFrom] = useState(presets[0].from);
  const [to, setTo] = useState(presets[0].to);
  const [activePreset, setActivePreset] = useState('thisMonth');
  const [branchId, setBranchId] = useState('');
  const [contractorId, setContractorId] = useState('');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);

  const [activeKey, setActiveKey] = useState<string>('visits');
  const [groupByByReport, setGroupByByReport] = useState<Record<string, string>>({});
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [data, setData] = useState<any | null>(null);
  const [overview, setOverview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // drill-down state
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const activeReport = REPORTS.find((r) => r.key === activeKey)!;
  const groupBy = groupByByReport[activeKey] ?? activeReport.groupBy?.[0]?.value;
  const detailGroupBy = activeReport.groupBy ? groupBy : activeReport.fixedDetailGroupBy;
  const isTimeGroup = ['day', 'week', 'month', 'year'].includes(groupBy ?? '');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiGet<Branch[]>('/admin/branches').then(setBranches).catch(() => {});
    apiGet<Contractor[]>('/admin/contractors').then(setContractors).catch(() => {});
  }, [isAuthenticated]);

  const baseParams = useMemo(
    () => ({
      from,
      to,
      branchId: activeReport.useBranch ? branchId : undefined,
      contractorId: activeReport.useContractor ? contractorId : undefined,
    }),
    [from, to, branchId, contractorId, activeReport],
  );

  const loadOverview = useCallback(() => {
    apiGet<any>(`/reports/overview${qs({ from, to, branchId })}`)
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [from, to, branchId]);

  const loadReport = useCallback(() => {
    setLoading(true);
    setError(null);
    setExpanded(null);
    setDetail(null);
    apiGet<any>(`${activeReport.endpoint}${qs({ ...baseParams, groupBy })}`)
      .then(setData)
      .catch((e) => {
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed to load report');
      })
      .finally(() => setLoading(false));
  }, [activeReport, baseParams, groupBy]);

  useEffect(() => {
    if (isAuthenticated) loadOverview();
  }, [isAuthenticated, loadOverview]);

  useEffect(() => {
    if (isAuthenticated) loadReport();
  }, [isAuthenticated, loadReport]);

  function applyPreset(p: { key: string; from: string; to: string }) {
    setActivePreset(p.key);
    setFrom(p.from);
    setTo(p.to);
  }

  function toggleRow(value: string) {
    if (expanded === value) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(value);
    setDetail(null);
    setDetailLoading(true);
    apiGet<any>(`${activeReport.endpoint}/detail${qs({ ...baseParams, groupBy: detailGroupBy, value })}`)
      .then(setDetail)
      .catch(() => setDetail({ rows: [] }))
      .finally(() => setDetailLoading(false));
  }

  const rows: any[] = data?.rows ?? [];

  function exportRows(fmt: 'csv' | 'pdf' | 'xlsx') {
    if (!rows.length) {
      setError('No data to export for the current filters.');
      return;
    }
    const name = `vms-${activeKey}-${groupBy ?? 'all'}-${from}_${to}`;
    const title = `${activeReport.label} · ${from} → ${to}`;
    if (fmt === 'csv') downloadCSV(`${name}.csv`, rows);
    else if (fmt === 'pdf') downloadPDF(`${name}.pdf`, title, rows);
    else {
      const totals = data?.totals
        ? [Object.fromEntries(Object.entries(data.totals).map(([k, v]) => [k, v as any]))]
        : [];
      downloadXLSX(name, [
        ...(totals.length ? [{ name: 'Summary', rows: totals }] : []),
        { name: activeReport.label, rows },
      ]);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading…</div>
      </div>
    );
  }

  const kpis = overview?.kpis;

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">Analytics &amp; Reports</h2>
            <p className="text-zinc-400 text-sm">
              Detailed breakdowns by month, branch/location, contractor, host and more — chart it, drill in, export, or schedule by email.
            </p>
          </div>
          <button
            onClick={() => { loadOverview(); loadReport(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* ── Filter bar ─────────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarRange className="w-4 h-4 text-blue-400" />
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activePreset === p.key ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-4 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">From</span>
              <input type="date" value={from}
                onChange={(e) => { setFrom(e.target.value); setActivePreset('custom'); }}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white [color-scheme:dark]" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">To</span>
              <input type="date" value={to}
                onChange={(e) => { setTo(e.target.value); setActivePreset('custom'); }}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white [color-scheme:dark]" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Branch / location</span>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!activeReport.useBranch}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-40">
                <option value="" className="bg-slate-900">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900">{b.name} — {b.location}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Contractor</span>
              <select value={contractorId} onChange={(e) => setContractorId(e.target.value)} disabled={!activeReport.useContractor}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-40">
                <option value="" className="bg-slate-900">All contractors</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900">{c.companyName}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── KPI strip ──────────────────────────────────────────── */}
        {kpis && (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label="Total visits" value={kpis.totalVisits} />
            <Kpi label="Unique visitors" value={kpis.uniqueVisitors} />
            <Kpi label="Checked in" value={kpis.checkedInVisits} />
            <Kpi label="Avg dwell (min)" value={kpis.avgVisitDurationMin ?? '—'} />
            <Kpi label="Worker hours" value={kpis.totalWorkerHours} />
            <Kpi label="Workers on site" value={kpis.uniqueWorkersOnSite} />
            <Kpi label="Active workers" value={kpis.activeWorkers} />
            <Kpi label="Contractors" value={kpis.contractors} />
            <Kpi label="Avg compliance" value={kpis.avgComplianceScore != null ? `${kpis.avgComplianceScore}%` : '—'} />
            <Kpi label="Completed visits" value={kpis.completedVisits} />
            <Kpi label="Rejected" value={kpis.rejectedVisits} />
            <Kpi label="Headcount" value={kpis.totalHeadcount} />
          </div>
        )}

        {/* ── Report selector tabs ───────────────────────────────── */}
        <div className="mb-4 flex gap-2 flex-wrap">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            return (
              <button key={r.key} onClick={() => setActiveKey(r.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeKey === r.key ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/10'
                }`}>
                <Icon className="w-4 h-4" /> {r.label}
              </button>
            );
          })}
        </div>

        {/* ── Active report panel ────────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 p-5 flex-wrap border-b border-white/10">
            <div>
              <h3 className="text-lg font-semibold text-white">{activeReport.label}</h3>
              <p className="text-sm text-zinc-400">{activeReport.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeReport.groupBy && (
                <select value={groupBy}
                  onChange={(e) => setGroupByByReport((m) => ({ ...m, [activeKey]: e.target.value }))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                  {activeReport.groupBy.map((g) => (
                    <option key={g.value} value={g.value} className="bg-slate-900">{g.label}</option>
                  ))}
                </select>
              )}
              <div className="flex rounded-lg bg-white/5 p-1">
                {(['chart', 'table'] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1 text-xs rounded capitalize transition-colors ${
                      view === v ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}>{v}</button>
                ))}
              </div>
              <button onClick={() => exportRows('csv')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                <Download className="w-4 h-4" /> CSV
              </button>
              <button onClick={() => exportRows('xlsx')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button onClick={() => exportRows('pdf')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium">
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>

          {data?.totals && (
            <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-white/10">
              {Object.entries(data.totals).map(([k, v]) => (
                <span key={k} className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-zinc-300 border border-white/10">
                  <span className="text-zinc-500">{humanize(k)}:</span>{' '}
                  <span className="text-white font-medium">{String(v)}</span>
                </span>
              ))}
            </div>
          )}

          {error && (
            <div className="p-4 text-sm text-red-200 bg-red-500/10 border-b border-red-500/20">{error}</div>
          )}

          {loading ? (
            <div className="p-12 text-center text-zinc-400">Loading report…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">No data for the selected filters.</div>
          ) : view === 'chart' ? (
            <div className="p-5">
              <ReportChart
                rows={rows}
                labelKey={activeReport.labelKey}
                series={activeReport.series}
                type={isTimeGroup ? 'line' : 'bar'}
              />
              <p className="text-xs text-zinc-600 mt-3">Switch to “Table” to drill into the records behind each bar.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[40rem]">
              <table className="w-full text-sm">
                <thead className="text-zinc-400 sticky top-0 bg-slate-900/90 backdrop-blur">
                  <tr>
                    <th className="w-8" />
                    {Object.keys(rows[0]).map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium whitespace-nowrap">{humanize(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-200">
                  {rows.map((row, i) => {
                    const val = String(row[activeReport.labelKey]);
                    const isOpen = expanded === val;
                    return (
                      <Fragment key={i}>
                        <tr onClick={() => toggleRow(val)} className="hover:bg-white/5 cursor-pointer">
                          <td className="pl-3 text-zinc-500">
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          {Object.keys(rows[0]).map((h) => (
                            <td key={h} className="px-4 py-2 whitespace-nowrap">
                              {row[h] === null || row[h] === undefined ? '—' : String(row[h])}
                            </td>
                          ))}
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={Object.keys(rows[0]).length + 1} className="bg-black/20 px-4 py-3">
                              {detailLoading ? (
                                <div className="text-zinc-500 text-xs py-3">Loading records…</div>
                              ) : !detail?.rows?.length ? (
                                <div className="text-zinc-500 text-xs py-3">No underlying records.</div>
                              ) : (
                                <div className="overflow-auto max-h-72 rounded-lg border border-white/10">
                                  <table className="w-full text-xs">
                                    <thead className="text-zinc-400 sticky top-0 bg-slate-900/95">
                                      <tr>
                                        {Object.keys(detail.rows[0]).map((h) => (
                                          <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{humanize(h)}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-zinc-300">
                                      {detail.rows.map((dr: any, di: number) => (
                                        <tr key={di}>
                                          {Object.keys(detail.rows[0]).map((h) => (
                                            <td key={h} className="px-3 py-1.5 whitespace-nowrap">
                                              {dr[h] === null || dr[h] === undefined ? '—' : String(dr[h])}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {detail.count >= 500 && (
                                    <p className="text-[11px] text-zinc-500 p-2 text-center">Showing first 500 records — narrow the date range to see more.</p>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Scheduled email reports ────────────────────────────── */}
        <SchedulesPanel />

        <p className="text-xs text-zinc-600 mt-4">
          All figures respect your organization scope. Hours use an 8h/day overtime threshold at 1.5× the worker&apos;s hourly rate.
        </p>
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
    </div>
  );
}

function humanize(s: string) {
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

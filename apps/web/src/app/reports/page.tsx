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
  CalendarClock,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Mail,
  Send,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
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
      { key: 'total', label: 'Total', color: 'rgba(99,102,241,0.85)' },
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
      { key: 'totalHours', label: 'Total hours', color: 'rgba(99,102,241,0.85)' },
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
      { key: 'totalWorkers', label: 'Workers', color: 'rgba(99,102,241,0.85)' },
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
      { key: 'visits', label: 'Visits', color: 'rgba(99,102,241,0.85)' },
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
      { key: 'total', label: 'Hosted', color: 'rgba(99,102,241,0.85)' },
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

type Notice = { kind: 'ok' | 'err'; text: string };

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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  // Drill-down state
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Email-this-report modal state
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

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
    setData(null);
    setExpanded(null);
    setDetail(null);
    apiGet<any>(`${activeReport.endpoint}${qs({ ...baseParams, groupBy })}`)
      .then(setData)
      .catch((e) => {
        setData(null);
        const raw = e instanceof Error ? e.message : 'Failed to load report';
        const isMissing = /404|not.*found|cannot.*get/i.test(raw);
        setError(
          isMissing
            ? `This report is still deploying on the API — wait ~30s and click Refresh. (${raw})`
            : raw,
        );
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

  // ── Per-card quick download (independent of the active report) ────
  async function downloadReport(def: ReportDef, fmt: 'csv' | 'xlsx' | 'pdf') {
    setDownloadingKey(`${def.key}:${fmt}`);
    setNotice(null);
    try {
      const gb = groupByByReport[def.key] ?? def.groupBy?.[0]?.value;
      const params = {
        from,
        to,
        branchId: def.useBranch ? branchId : undefined,
        contractorId: def.useContractor ? contractorId : undefined,
        groupBy: gb,
      };
      const payload = await apiGet<any>(`${def.endpoint}${qs(params)}`);
      const dRows: any[] = payload?.rows ?? [];
      if (!dRows.length) {
        setNotice({ kind: 'err', text: `No data for ${def.label} in the selected filters.` });
        return;
      }
      const name = `vms-${def.key}-${gb ?? 'all'}-${from}_${to}`;
      const title = `${def.label} · ${from} → ${to}`;
      if (fmt === 'csv') downloadCSV(`${name}.csv`, dRows);
      else if (fmt === 'pdf') downloadPDF(`${name}.pdf`, title, dRows);
      else {
        const totals = payload?.totals
          ? [Object.fromEntries(Object.entries(payload.totals).map(([k, v]) => [k, v as any]))]
          : [];
        downloadXLSX(name, [
          ...(totals.length ? [{ name: 'Summary', rows: totals }] : []),
          { name: def.label, rows: dRows },
        ]);
      }
      setNotice({ kind: 'ok', text: `Downloaded ${def.label} (${dRows.length} rows)` });
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Download failed' });
    } finally {
      setDownloadingKey(null);
    }
  }

  function exportActive(fmt: 'csv' | 'pdf' | 'xlsx') {
    if (!rows.length) {
      setNotice({ kind: 'err', text: 'No data to export for the current filters.' });
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

  // ── Email-this-report dialog ─────────────────────────────────────
  function openEmailFor(key: string) {
    const def = REPORTS.find((r) => r.key === key)!;
    setEmailFor(key);
    setEmailRecipients('');
    setEmailSubject(`${def.label} · ${from} → ${to}`);
  }

  async function sendEmail() {
    if (!emailFor) return;
    const def = REPORTS.find((r) => r.key === emailFor)!;
    const gb = groupByByReport[emailFor] ?? def.groupBy?.[0]?.value;
    setEmailBusy(true);
    setNotice(null);
    try {
      const res = await apiPost<{ status: string; sent: number; failed: number; rows: number }>(
        '/reports/email',
        {
          report: emailFor,
          groupBy: gb,
          from,
          to,
          branchId: def.useBranch ? branchId : undefined,
          contractorId: def.useContractor ? contractorId : undefined,
          recipients: emailRecipients,
          subject: emailSubject || undefined,
        },
      );
      setNotice({
        kind: res.sent > 0 ? 'ok' : 'err',
        text: `${def.label}: ${res.status}`,
      });
      setEmailFor(null);
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Email failed' });
    } finally {
      setEmailBusy(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-tertiary">Loading…</div>
      </div>
    );
  }

  const kpis = overview?.kpis;
  const activeDef = REPORTS.find((r) => r.key === emailFor);

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* ── Page header ────────────────────────────────────────── */}
        <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[11px] uppercase tracking-wider font-medium mb-3">
              <Sparkles className="w-3 h-3" /> Analytics
            </div>
            <h2 className="text-3xl font-bold text-text-primary mb-1">Reports &amp; Insights</h2>
            <p className="text-text-secondary text-sm">
              Six reporting families, drill-down to raw records, download in three formats, or email any report directly from here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { loadOverview(); loadReport(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Toast strip */}
        {notice && (
          <div
            className={`mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center justify-between gap-3 ${
              notice.kind === 'ok'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Filter bar ─────────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl border border-border-subtle bg-surface-1 p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarRange className="w-4 h-4 text-brand-400" />
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activePreset === p.key
                    ? 'bg-brand-gradient text-white shadow-brand-glow'
                    : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary border border-border-subtle'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-4 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-tertiary">From</span>
              <input type="date" value={from}
                onChange={(e) => { setFrom(e.target.value); setActivePreset('custom'); }}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-tertiary">To</span>
              <input type="date" value={to}
                onChange={(e) => { setTo(e.target.value); setActivePreset('custom'); }}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-tertiary">Branch / location</span>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary">
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} — {b.location}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-tertiary">Contractor</span>
              <select value={contractorId} onChange={(e) => setContractorId(e.target.value)}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary">
                <option value="">All contractors</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── KPI strip ──────────────────────────────────────────── */}
        {kpis && (
          <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

        {/* ── Report card grid ───────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-text-tertiary font-semibold">
            Pick a report — or grab a download right from the card
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            const isActive = activeKey === r.key;
            const busy = downloadingKey?.startsWith(`${r.key}:`);
            return (
              <div
                key={r.key}
                className={`relative rounded-2xl p-5 border transition-all ${
                  isActive
                    ? 'border-brand-400/60 bg-brand-500/[0.06] ring-2 ring-brand-500/30 shadow-brand-glow'
                    : 'border-border-subtle bg-surface-1 hover:border-border-strong hover:bg-surface-2'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveKey(r.key)}
                  className="text-left w-full"
                  data-tab={r.key}
                  data-active={isActive}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center bg-brand-gradient text-white shadow-brand-glow">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-text-primary truncate">{r.label}</h4>
                      <p className="text-xs text-text-secondary mt-1 leading-snug line-clamp-2">
                        {r.description}
                      </p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 mt-1 text-text-tertiary transition-transform ${
                        isActive ? 'rotate-90 text-brand-400' : ''
                      }`}
                    />
                  </div>
                </button>

                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center gap-1.5 flex-wrap">
                  <QuickAction
                    icon={FileSpreadsheet}
                    label="Excel"
                    busy={downloadingKey === `${r.key}:xlsx`}
                    onClick={() => downloadReport(r, 'xlsx')}
                  />
                  <QuickAction
                    icon={Download}
                    label="CSV"
                    busy={downloadingKey === `${r.key}:csv`}
                    onClick={() => downloadReport(r, 'csv')}
                  />
                  <QuickAction
                    icon={FileText}
                    label="PDF"
                    busy={downloadingKey === `${r.key}:pdf`}
                    onClick={() => downloadReport(r, 'pdf')}
                  />
                  <span className="flex-1" />
                  <QuickAction
                    icon={Mail}
                    label="Email"
                    accent
                    onClick={() => openEmailFor(r.key)}
                  />
                </div>

                {busy && (
                  <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-surface-1/70 backdrop-blur-sm">
                    <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Active report detail panel ─────────────────────────── */}
        <div className="mt-8 rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
          <div className="flex items-center justify-between gap-4 p-5 flex-wrap border-b border-border-subtle">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-brand-gradient text-white">
                <activeReport.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-text-primary">{activeReport.label}</h3>
                <p className="text-sm text-text-secondary truncate">{activeReport.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeReport.groupBy && (
                <select
                  value={groupBy}
                  onChange={(e) =>
                    setGroupByByReport((m) => ({ ...m, [activeKey]: e.target.value }))
                  }
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                >
                  {activeReport.groupBy.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              )}
              <div className="flex rounded-lg bg-surface-2 border border-border-subtle p-1">
                {(['chart', 'table'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-3 py-1 text-xs rounded capitalize transition-colors ${
                      view === v
                        ? 'bg-brand-gradient text-white'
                        : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => openEmailFor(activeKey)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary text-sm font-medium transition-colors"
                title="Email this report now"
              >
                <Mail className="w-4 h-4" /> Email
              </button>
              <button
                type="button"
                onClick={() => exportActive('csv')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              <button
                type="button"
                onClick={() => exportActive('xlsx')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button
                type="button"
                onClick={() => exportActive('pdf')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>

          {data?.totals && (
            <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border-subtle bg-surface-2/50">
              {Object.entries(data.totals).map(([k, v]) => (
                <span
                  key={k}
                  className="text-xs px-2.5 py-1 rounded-md bg-surface-1 border border-border-subtle text-text-secondary"
                >
                  <span className="text-text-tertiary">{humanize(k)}:</span>{' '}
                  <span className="text-text-primary font-medium">{String(v)}</span>
                </span>
              ))}
            </div>
          )}

          {error && (
            <div className="p-4 text-sm text-red-300 bg-red-500/10 border-b border-red-500/30">{error}</div>
          )}

          {loading ? (
            <div className="p-12 text-center text-text-tertiary">Loading report…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-text-tertiary">No data for the selected filters.</div>
          ) : view === 'chart' ? (
            <div className="p-5">
              <ReportChart
                rows={rows}
                labelKey={activeReport.labelKey}
                series={activeReport.series}
                type={isTimeGroup ? 'line' : 'bar'}
              />
              <p className="text-xs text-text-tertiary mt-3">Switch to Table to drill into the records behind each bar.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[40rem]">
              <table className="w-full text-sm">
                <thead className="text-text-tertiary sticky top-0 bg-surface-2/95 backdrop-blur">
                  <tr>
                    <th className="w-8" />
                    {Object.keys(rows[0]).map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium whitespace-nowrap">{humanize(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-secondary">
                  {rows.map((row, i) => {
                    const val = String(row[activeReport.labelKey]);
                    const isOpen = expanded === val;
                    return (
                      <Fragment key={i}>
                        <tr onClick={() => toggleRow(val)} className="hover:bg-surface-2 cursor-pointer">
                          <td className="pl-3 text-text-tertiary">
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
                            <td colSpan={Object.keys(rows[0]).length + 1} className="bg-surface-2/60 px-4 py-3">
                              {detailLoading ? (
                                <div className="text-text-tertiary text-xs py-3">Loading records…</div>
                              ) : !detail?.rows?.length ? (
                                <div className="text-text-tertiary text-xs py-3">No underlying records.</div>
                              ) : (
                                <div className="overflow-auto max-h-72 rounded-lg border border-border-subtle">
                                  <table className="w-full text-xs">
                                    <thead className="text-text-tertiary sticky top-0 bg-surface-2/95">
                                      <tr>
                                        {Object.keys(detail.rows[0]).map((h) => (
                                          <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{humanize(h)}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle text-text-secondary">
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
                                    <p className="text-[11px] text-text-tertiary p-2 text-center">Showing first 500 records — narrow the date range to see more.</p>
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

        {/* ── Scheduled email reports — collapsed disclosure ─────── */}
        <details className="mt-8 group rounded-2xl border border-border-subtle bg-surface-1">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 p-4 hover:bg-surface-2 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-2 border border-border-subtle">
                <CalendarClock className="w-4 h-4 text-brand-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">Scheduled email reports</div>
                <div className="text-xs text-text-tertiary">Auto-deliver any report on a daily, weekly or monthly cadence.</div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-text-tertiary transition-transform group-open:rotate-180" />
          </summary>
          <div className="-mt-2">
            <SchedulesPanel />
          </div>
        </details>

        <p className="text-xs text-text-tertiary mt-6">
          All figures respect your organization scope. Hours use an 8h/day overtime threshold at 1.5× the worker&apos;s hourly rate.
        </p>
      </div>

      {/* ── Email modal ──────────────────────────────────────────── */}
      {emailFor && activeDef && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur"
          onClick={(e) => { if (e.target === e.currentTarget) setEmailFor(null); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-1 shadow-2xl">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-gradient text-white">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">Email this report</h3>
                  <p className="text-xs text-text-tertiary">
                    {activeDef.label} · {from} → {to} — sent as CSV + Excel attachments
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setEmailFor(null)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-text-tertiary font-medium">Recipients</span>
                <input
                  type="text"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="ops@acme.com, hr@acme.com"
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60"
                />
                <span className="text-[11px] text-text-tertiary">Comma-separate multiple emails.</span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-text-tertiary font-medium">Subject (optional)</span>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={`${activeDef.label} report`}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border-subtle bg-surface-2/40 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setEmailFor(null)}
                className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendEmail}
                disabled={!emailRecipients.trim() || emailBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gradient text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-brand-glow"
              >
                {emailBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {emailBusy ? 'Sending…' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 px-4 py-3">
      <div className="text-2xl font-bold text-text-primary tabular-nums">{value}</div>
      <div className="text-xs text-text-tertiary mt-0.5">{label}</div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  busy,
  accent,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  busy?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onClick();
      }}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
        accent
          ? 'bg-brand-500/15 hover:bg-brand-500/25 text-brand-300 border border-brand-500/30'
          : 'bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary border border-border-subtle'
      }`}
      disabled={busy}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      <span>{label}</span>
    </button>
  );
}

function humanize(s: string) {
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

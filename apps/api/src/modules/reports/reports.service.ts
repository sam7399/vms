import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  JwtUser,
  attendanceScope,
  branchScope,
  contractorScope,
  isSuperAdmin,
  requireOrg,
  userScope,
  visitScope,
} from '../../common/tenant';

// ───────────────────────────────────────────────────────────────────
// Reporting engine.
//
// Every report accepts a common filter (date range + optional branch /
// contractor) and an optional `groupBy` dimension. Aggregation is done
// in-memory over scoped Prisma reads — same approach as the rest of the
// codebase (admin.service worker-hours / heatmap) — so it stays portable
// across Postgres without raw SQL and respects multi-tenant scoping.
// ───────────────────────────────────────────────────────────────────

export interface ReportFilter {
  from?: string;
  to?: string;
  branchId?: string;
  contractorId?: string;
  groupBy?: string;
}

type Period = 'day' | 'week' | 'month' | 'year';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const OVERTIME_THRESHOLD_HOURS = 8;
const OVERTIME_MULTIPLIER = 1.5;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Date helpers ──────────────────────────────────────────────────

  /** Resolve a {from,to} filter into a concrete window. Defaults to last 30d. */
  private resolveRange(f: ReportFilter): { from: Date; to: Date } {
    const to = f.to ? new Date(f.to) : new Date();
    let from: Date;
    if (f.from) {
      from = new Date(f.from);
    } else {
      from = new Date(to.getTime() - 30 * DAY_MS);
    }
    if (Number.isNaN(from.getTime())) from = new Date(to.getTime() - 30 * DAY_MS);
    if (Number.isNaN(to.getTime())) return { from, to: new Date() };
    // Make `to` inclusive of the whole day when only a date was supplied
    if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  private isoWeek(d: Date): string {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  /** Bucket a date into a period label (UTC). */
  private periodKey(d: Date, period: Period): string {
    const dt = new Date(d);
    switch (period) {
      case 'year':
        return `${dt.getUTCFullYear()}`;
      case 'month':
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
      case 'week':
        return this.isoWeek(dt);
      case 'day':
      default:
        return dt.toISOString().slice(0, 10);
    }
  }

  private round(n: number, places = 2): number {
    const f = Math.pow(10, places);
    return Math.round(n * f) / f;
  }

  // ── Visit reporting ───────────────────────────────────────────────

  /**
   * Visit analytics grouped by a chosen dimension.
   * groupBy: month | week | day | year | branch | host | status | company | purpose
   */
  async visits(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';

    const where: any = { createdAt: { gte: from, lte: to }, ...visitScope(user) };
    if (f.branchId) where.branchId = f.branchId;

    const visits = await this.prisma.visit.findMany({
      where,
      select: {
        id: true,
        status: true,
        purpose: true,
        groupSize: true,
        vehicleNumber: true,
        createdAt: true,
        actualEntry: true,
        actualExit: true,
        visitorId: true,
        visitor: { select: { company: true } },
        host: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    });

    const groups = new Map<string, any>();
    const ensure = (key: string) => {
      let g = groups.get(key);
      if (!g) {
        g = {
          group: key,
          total: 0,
          headcount: 0,
          pending: 0,
          approved: 0,
          checkedIn: 0,
          checkedOut: 0,
          rejected: 0,
          blacklisted: 0,
          withVehicle: 0,
          _visitors: new Set<string>(),
          _durations: [] as number[],
        };
        groups.set(key, g);
      }
      return g;
    };

    const keyFor = (v: (typeof visits)[number]): string => {
      switch (groupBy) {
        case 'branch':
          return v.branch?.name || '—';
        case 'host':
          return v.host?.fullName || '—';
        case 'status':
          return v.status;
        case 'company':
          return v.visitor?.company || '(none)';
        case 'purpose':
          return (v.purpose || '—').slice(0, 60);
        default:
          return this.periodKey(v.createdAt, groupBy as Period);
      }
    };

    for (const v of visits) {
      const g = ensure(keyFor(v));
      g.total += 1;
      g.headcount += v.groupSize || 1;
      g._visitors.add(v.visitorId);
      if (v.vehicleNumber) g.withVehicle += 1;
      switch (v.status) {
        case 'PENDING': g.pending += 1; break;
        case 'APPROVED': g.approved += 1; break;
        case 'CHECKED_IN': g.checkedIn += 1; break;
        case 'CHECKED_OUT': g.checkedOut += 1; break;
        case 'REJECTED': g.rejected += 1; break;
        case 'BLACKLISTED': g.blacklisted += 1; break;
      }
      if (v.actualEntry && v.actualExit) {
        const mins = (new Date(v.actualExit).getTime() - new Date(v.actualEntry).getTime()) / 60_000;
        if (mins > 0) g._durations.push(mins);
      }
    }

    const rows = [...groups.values()].map((g) => ({
      group: g.group,
      total: g.total,
      uniqueVisitors: g._visitors.size,
      headcount: g.headcount,
      pending: g.pending,
      approved: g.approved,
      checkedIn: g.checkedIn,
      checkedOut: g.checkedOut,
      rejected: g.rejected,
      blacklisted: g.blacklisted,
      withVehicle: g.withVehicle,
      avgDurationMin: g._durations.length
        ? this.round(g._durations.reduce((a: number, b: number) => a + b, 0) / g._durations.length)
        : null,
    }));

    this.sortRows(rows, groupBy);

    return {
      report: 'visits',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        visits: visits.length,
        uniqueVisitors: new Set(visits.map((v) => v.visitorId)).size,
        checkedIn: visits.filter((v) => v.status === 'CHECKED_IN').length,
        rejected: visits.filter((v) => v.status === 'REJECTED').length,
      },
      rows,
    };
  }

  // ── Workforce / attendance reporting ──────────────────────────────

  /**
   * Worker attendance + hours + overtime + estimated pay, grouped.
   * groupBy: month | week | day | year | contractor | worker | branch | skill
   */
  async workforce(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';

    const where: any = { checkIn: { gte: from, lte: to }, ...attendanceScope(user) };
    if (f.branchId) where.branchId = f.branchId;
    if (f.contractorId) where.worker = { contractorId: f.contractorId };

    const records = await this.prisma.attendance.findMany({
      where,
      select: {
        workerId: true,
        branchId: true,
        checkIn: true,
        checkOut: true,
        worker: {
          select: {
            fullName: true,
            skillCategory: true,
            hourlyRate: true,
            contractor: { select: { companyName: true } },
          },
        },
        branch: { select: { name: true } },
      },
    });

    // Pre-aggregate to (group, worker, day) so overtime (>8h/worker/day) is correct.
    type Cell = { hours: number; rate: number | null };
    const cells = new Map<string, Cell>();
    const groupMeta = new Map<string, { workers: Set<string>; workerDays: Set<string> }>();

    const keyFor = (r: (typeof records)[number]): string => {
      switch (groupBy) {
        case 'contractor':
          return r.worker?.contractor?.companyName || '—';
        case 'worker':
          return r.worker?.fullName || '—';
        case 'branch':
          return r.branch?.name || '—';
        case 'skill':
          return r.worker?.skillCategory || '—';
        default:
          return this.periodKey(r.checkIn, groupBy as Period);
      }
    };

    for (const r of records) {
      const groupKey = keyFor(r);
      const day = r.checkIn.toISOString().slice(0, 10);
      const hours = r.checkOut
        ? Math.max(0, (r.checkOut.getTime() - r.checkIn.getTime()) / HOUR_MS)
        : 0;
      const cellKey = `${groupKey}|${r.workerId}|${day}`;
      const c = cells.get(cellKey) || { hours: 0, rate: r.worker?.hourlyRate ?? null };
      c.hours += hours;
      cells.set(cellKey, c);

      const meta = groupMeta.get(groupKey) || { workers: new Set<string>(), workerDays: new Set<string>() };
      meta.workers.add(r.workerId);
      meta.workerDays.add(`${r.workerId}|${day}`);
      groupMeta.set(groupKey, meta);
    }

    const agg = new Map<string, { totalHours: number; overtimeHours: number; estimatedPay: number; hasRate: boolean }>();
    for (const [cellKey, c] of cells) {
      const groupKey = cellKey.split('|')[0];
      const ot = Math.max(0, c.hours - OVERTIME_THRESHOLD_HOURS);
      const reg = c.hours - ot;
      const a = agg.get(groupKey) || { totalHours: 0, overtimeHours: 0, estimatedPay: 0, hasRate: false };
      a.totalHours += c.hours;
      a.overtimeHours += ot;
      if (c.rate != null) {
        a.estimatedPay += reg * c.rate + ot * c.rate * OVERTIME_MULTIPLIER;
        a.hasRate = true;
      }
      agg.set(groupKey, a);
    }

    const rows = [...agg.entries()].map(([group, a]) => {
      const meta = groupMeta.get(group)!;
      return {
        group,
        workers: meta.workers.size,
        shifts: meta.workerDays.size,
        totalHours: this.round(a.totalHours),
        overtimeHours: this.round(a.overtimeHours),
        avgHoursPerWorker: meta.workers.size ? this.round(a.totalHours / meta.workers.size) : 0,
        estimatedPay: a.hasRate ? this.round(a.estimatedPay) : null,
      };
    });

    this.sortRows(rows, groupBy);

    const totalHours = rows.reduce((s, r) => s + r.totalHours, 0);
    return {
      report: 'workforce',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        records: records.length,
        uniqueWorkers: new Set(records.map((r) => r.workerId)).size,
        totalHours: this.round(totalHours),
        overtimeHours: this.round(rows.reduce((s, r) => s + r.overtimeHours, 0)),
        estimatedPay: this.round(rows.reduce((s, r) => s + (r.estimatedPay ?? 0), 0)),
      },
      rows,
    };
  }

  // ── Contractor-wise summary ───────────────────────────────────────

  async contractors(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);

    const contractors = await this.prisma.contractor.findMany({
      where: contractorScope(user),
      select: {
        id: true,
        companyName: true,
        gstNumber: true,
        complianceScore: true,
        createdAt: true,
        workers: {
          select: {
            id: true,
            isActive: true,
            policeVerified: true,
            medicalExpiry: true,
            hourlyRate: true,
          },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    // Pull attendance for the window once, scoped, keyed by worker.
    const attendance = await this.prisma.attendance.findMany({
      where: { checkIn: { gte: from, lte: to }, checkOut: { not: null }, ...attendanceScope(user) },
      select: { workerId: true, checkIn: true, checkOut: true, worker: { select: { contractorId: true, hourlyRate: true } } },
    });

    // (contractorId) -> per (worker,day) hours for overtime-correct pay
    const perContractorCells = new Map<string, Map<string, { hours: number; rate: number | null }>>();
    for (const a of attendance) {
      const cId = a.worker?.contractorId;
      if (!cId || !a.checkOut) continue;
      const day = a.checkIn.toISOString().slice(0, 10);
      const cells = perContractorCells.get(cId) || new Map();
      const cellKey = `${a.workerId}|${day}`;
      const c = cells.get(cellKey) || { hours: 0, rate: a.worker?.hourlyRate ?? null };
      c.hours += Math.max(0, (a.checkOut.getTime() - a.checkIn.getTime()) / HOUR_MS);
      cells.set(cellKey, c);
      perContractorCells.set(cId, cells);
    }

    const now = Date.now();
    const rows = contractors.map((c) => {
      const cells = perContractorCells.get(c.id);
      let totalHours = 0;
      let overtimeHours = 0;
      let estimatedPay = 0;
      let hasRate = false;
      const activeWorkerIds = new Set<string>();
      if (cells) {
        for (const [cellKey, cell] of cells) {
          activeWorkerIds.add(cellKey.split('|')[0]);
          const ot = Math.max(0, cell.hours - OVERTIME_THRESHOLD_HOURS);
          totalHours += cell.hours;
          overtimeHours += ot;
          if (cell.rate != null) {
            estimatedPay += (cell.hours - ot) * cell.rate + ot * cell.rate * OVERTIME_MULTIPLIER;
            hasRate = true;
          }
        }
      }
      const expiredMedical = c.workers.filter((w) => w.medicalExpiry && w.medicalExpiry.getTime() < now).length;
      const unverified = c.workers.filter((w) => !w.policeVerified).length;
      return {
        contractor: c.companyName,
        gstNumber: c.gstNumber,
        complianceScore: c.complianceScore,
        totalWorkers: c.workers.length,
        activeWorkers: c.workers.filter((w) => w.isActive).length,
        workersOnSite: activeWorkerIds.size,
        expiredMedical,
        policeUnverified: unverified,
        totalHours: this.round(totalHours),
        overtimeHours: this.round(overtimeHours),
        estimatedPay: hasRate ? this.round(estimatedPay) : null,
      };
    });

    return {
      report: 'contractors',
      groupBy: 'contractor',
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        contractors: rows.length,
        totalWorkers: rows.reduce((s, r) => s + r.totalWorkers, 0),
        totalHours: this.round(rows.reduce((s, r) => s + r.totalHours, 0)),
        estimatedPay: this.round(rows.reduce((s, r) => s + (r.estimatedPay ?? 0), 0)),
      },
      rows,
    };
  }

  // ── Branch / location-wise summary ────────────────────────────────

  async branches(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);

    const branches = await this.prisma.branch.findMany({
      where: branchScope(user),
      select: { id: true, name: true, location: true },
      orderBy: { name: 'asc' },
    });
    const branchIndex = new Map(branches.map((b) => [b.id, b]));

    const visits = await this.prisma.visit.findMany({
      where: { createdAt: { gte: from, lte: to }, ...visitScope(user) },
      select: { branchId: true, status: true, visitorId: true, groupSize: true },
    });

    const attendance = await this.prisma.attendance.findMany({
      where: { checkIn: { gte: from, lte: to }, ...attendanceScope(user) },
      select: { branchId: true, workerId: true, checkIn: true, checkOut: true },
    });

    type Acc = {
      visits: number;
      headcount: number;
      checkedIn: number;
      rejected: number;
      visitors: Set<string>;
      workers: Set<string>;
      workerHours: number;
    };
    const acc = new Map<string, Acc>();
    const ensure = (id: string) => {
      let a = acc.get(id);
      if (!a) {
        a = { visits: 0, headcount: 0, checkedIn: 0, rejected: 0, visitors: new Set(), workers: new Set(), workerHours: 0 };
        acc.set(id, a);
      }
      return a;
    };

    for (const v of visits) {
      const a = ensure(v.branchId);
      a.visits += 1;
      a.headcount += v.groupSize || 1;
      a.visitors.add(v.visitorId);
      if (v.status === 'CHECKED_IN') a.checkedIn += 1;
      if (v.status === 'REJECTED') a.rejected += 1;
    }
    for (const at of attendance) {
      const a = ensure(at.branchId);
      a.workers.add(at.workerId);
      if (at.checkOut) a.workerHours += Math.max(0, (at.checkOut.getTime() - at.checkIn.getTime()) / HOUR_MS);
    }

    const rows = [...acc.entries()]
      .filter(([id]) => branchIndex.has(id))
      .map(([id, a]) => {
        const b = branchIndex.get(id)!;
        return {
          branch: b.name,
          location: b.location,
          visits: a.visits,
          headcount: a.headcount,
          uniqueVisitors: a.visitors.size,
          checkedIn: a.checkedIn,
          rejected: a.rejected,
          workersOnSite: a.workers.size,
          workerHours: this.round(a.workerHours),
        };
      });

    // Include branches with zero activity too (full directory).
    for (const b of branches) {
      if (!acc.has(b.id)) {
        rows.push({
          branch: b.name,
          location: b.location,
          visits: 0,
          headcount: 0,
          uniqueVisitors: 0,
          checkedIn: 0,
          rejected: 0,
          workersOnSite: 0,
          workerHours: 0,
        });
      }
    }
    rows.sort((a, b) => b.visits - a.visits);

    return {
      report: 'branches',
      groupBy: 'branch',
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        branches: rows.length,
        visits: visits.length,
        workerHours: this.round(rows.reduce((s, r) => s + r.workerHours, 0)),
      },
      rows,
    };
  }

  // ── User / host activity ──────────────────────────────────────────

  async users(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);

    const where: any = { createdAt: { gte: from, lte: to }, ...visitScope(user) };
    if (f.branchId) where.branchId = f.branchId;

    const visits = await this.prisma.visit.findMany({
      where,
      select: {
        status: true,
        hostId: true,
        host: { select: { fullName: true, email: true, role: true, branch: { select: { name: true } } } },
      },
    });

    const groups = new Map<string, any>();
    for (const v of visits) {
      let g = groups.get(v.hostId);
      if (!g) {
        g = {
          host: v.host?.fullName || '—',
          email: v.host?.email || '—',
          role: v.host?.role || '—',
          branch: v.host?.branch?.name || '—',
          total: 0,
          pending: 0,
          approved: 0,
          checkedIn: 0,
          checkedOut: 0,
          rejected: 0,
        };
        groups.set(v.hostId, g);
      }
      g.total += 1;
      switch (v.status) {
        case 'PENDING': g.pending += 1; break;
        case 'APPROVED': g.approved += 1; break;
        case 'CHECKED_IN': g.checkedIn += 1; break;
        case 'CHECKED_OUT': g.checkedOut += 1; break;
        case 'REJECTED': g.rejected += 1; break;
      }
    }

    const rows = [...groups.values()].sort((a, b) => b.total - a.total);
    return {
      report: 'users',
      groupBy: 'host',
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: { hosts: rows.length, visits: visits.length },
      rows,
    };
  }

  // ── Material gate-pass movement ───────────────────────────────────

  async materials(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';

    const where: any = { createdAt: { gte: from, lte: to } };
    if (!isSuperAdmin(user)) where.visit = { branch: { organizationId: requireOrg(user) } };
    if (f.branchId) where.visit = { ...(where.visit || {}), branchId: f.branchId };

    const passes = await this.prisma.materialGatePass.findMany({
      where,
      select: {
        direction: true,
        quantity: true,
        createdAt: true,
        visit: { select: { branch: { select: { name: true } } } },
      },
    });

    const groups = new Map<string, any>();
    const keyFor = (p: (typeof passes)[number]) => {
      if (groupBy === 'branch') return p.visit?.branch?.name || '—';
      if (groupBy === 'direction') return p.direction;
      return this.periodKey(p.createdAt, groupBy as Period);
    };

    for (const p of passes) {
      const key = keyFor(p);
      let g = groups.get(key);
      if (!g) {
        g = { group: key, inCount: 0, inQty: 0, outCount: 0, outQty: 0 };
        groups.set(key, g);
      }
      if (p.direction === 'IN') {
        g.inCount += 1;
        g.inQty += p.quantity || 1;
      } else {
        g.outCount += 1;
        g.outQty += p.quantity || 1;
      }
    }

    const rows = [...groups.values()];
    this.sortRows(rows, groupBy);

    return {
      report: 'materials',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        passes: passes.length,
        inQty: rows.reduce((s, r) => s + r.inQty, 0),
        outQty: rows.reduce((s, r) => s + r.outQty, 0),
      },
      rows,
    };
  }

  // ── Executive overview / KPIs ─────────────────────────────────────

  async overview(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const branchFilter = f.branchId ? { branchId: f.branchId } : {};

    const [visits, attendance, contractors, workerCount, activeWorkerCount] = await Promise.all([
      this.prisma.visit.findMany({
        where: { createdAt: { gte: from, lte: to }, ...visitScope(user), ...branchFilter },
        select: { status: true, visitorId: true, groupSize: true, actualEntry: true, actualExit: true },
      }),
      this.prisma.attendance.findMany({
        where: { checkIn: { gte: from, lte: to }, ...attendanceScope(user), ...branchFilter },
        select: { workerId: true, checkIn: true, checkOut: true },
      }),
      this.prisma.contractor.findMany({
        where: contractorScope(user),
        select: { complianceScore: true },
      }),
      this.prisma.worker.count({ where: isSuperAdmin(user) ? {} : { contractor: { organizationId: requireOrg(user) } } }),
      this.prisma.worker.count({
        where: { isActive: true, ...(isSuperAdmin(user) ? {} : { contractor: { organizationId: requireOrg(user) } }) },
      }),
    ]);

    const durations = visits
      .filter((v) => v.actualEntry && v.actualExit)
      .map((v) => (new Date(v.actualExit!).getTime() - new Date(v.actualEntry!).getTime()) / 60_000)
      .filter((m) => m > 0);

    let workerHours = 0;
    for (const a of attendance) {
      if (a.checkOut) workerHours += Math.max(0, (a.checkOut.getTime() - a.checkIn.getTime()) / HOUR_MS);
    }

    const avgCompliance = contractors.length
      ? this.round(contractors.reduce((s, c) => s + c.complianceScore, 0) / contractors.length, 1)
      : null;

    return {
      report: 'overview',
      range: { from: from.toISOString(), to: to.toISOString() },
      kpis: {
        totalVisits: visits.length,
        uniqueVisitors: new Set(visits.map((v) => v.visitorId)).size,
        totalHeadcount: visits.reduce((s, v) => s + (v.groupSize || 1), 0),
        checkedInVisits: visits.filter((v) => v.status === 'CHECKED_IN').length,
        completedVisits: visits.filter((v) => v.status === 'CHECKED_OUT').length,
        rejectedVisits: visits.filter((v) => v.status === 'REJECTED').length,
        avgVisitDurationMin: durations.length
          ? this.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
        attendanceRecords: attendance.length,
        uniqueWorkersOnSite: new Set(attendance.map((a) => a.workerId)).size,
        totalWorkerHours: this.round(workerHours),
        contractors: contractors.length,
        totalWorkers: workerCount,
        activeWorkers: activeWorkerCount,
        avgComplianceScore: avgCompliance,
      },
    };
  }

  // ── Drill-down: raw records behind one grouped row ────────────────

  /** Convert a time-bucket label back into an absolute [from,to] window. */
  private bucketSubRange(groupBy: string, value: string): { from: Date; to: Date } | null {
    try {
      if (groupBy === 'year' && /^\d{4}$/.test(value)) {
        return {
          from: new Date(Date.UTC(+value, 0, 1)),
          to: new Date(Date.UTC(+value, 11, 31, 23, 59, 59, 999)),
        };
      }
      if (groupBy === 'month' && /^\d{4}-\d{2}$/.test(value)) {
        const [y, m] = value.split('-').map(Number);
        return {
          from: new Date(Date.UTC(y, m - 1, 1)),
          to: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
        };
      }
      if (groupBy === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const from = new Date(`${value}T00:00:00.000Z`);
        const to = new Date(`${value}T23:59:59.999Z`);
        return { from, to };
      }
      if (groupBy === 'week' && /^\d{4}-W\d{2}$/.test(value)) {
        const [y, w] = value.split('-W').map(Number);
        // ISO week: week 1 contains the first Thursday.
        const jan4 = new Date(Date.UTC(y, 0, 4));
        const day = jan4.getUTCDay() || 7;
        const week1Mon = new Date(jan4);
        week1Mon.setUTCDate(jan4.getUTCDate() - day + 1);
        const from = new Date(week1Mon);
        from.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7);
        const to = new Date(from);
        to.setUTCDate(from.getUTCDate() + 6);
        to.setUTCHours(23, 59, 59, 999);
        return { from, to };
      }
    } catch {
      /* fallthrough */
    }
    return null;
  }

  private isTimeGroup(groupBy: string) {
    return ['day', 'week', 'month', 'year'].includes(groupBy);
  }

  /**
   * Return the underlying records for a single grouped row (the value the
   * user clicked). Capped at 500 rows — exports use the grouped endpoints.
   */
  async detail(user: JwtUser, report: string, f: ReportFilter, value: string) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';
    const sub = this.isTimeGroup(groupBy) ? this.bucketSubRange(groupBy, value) : null;
    const winFrom = sub ? new Date(Math.max(from.getTime(), sub.from.getTime())) : from;
    const winTo = sub ? new Date(Math.min(to.getTime(), sub.to.getTime())) : to;
    const TAKE = 500;

    if (report === 'visits' || report === 'users' || report === 'branches') {
      const where: any = { createdAt: { gte: winFrom, lte: winTo }, ...visitScope(user) };
      if (f.branchId) where.branchId = f.branchId;
      if (!this.isTimeGroup(groupBy)) {
        if (groupBy === 'branch' || report === 'branches') where.branch = { name: value };
        else if (groupBy === 'host' || report === 'users') where.host = { fullName: value };
        else if (groupBy === 'status') where.status = value;
        else if (groupBy === 'company') where.visitor = value === '(none)' ? { company: null } : { company: value };
        else if (groupBy === 'purpose') where.purpose = { startsWith: value.slice(0, 40) };
      }
      const rows = await this.prisma.visit.findMany({
        where,
        take: TAKE,
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          status: true,
          purpose: true,
          actualEntry: true,
          actualExit: true,
          vehicleNumber: true,
          visitor: { select: { fullName: true, phone: true, company: true } },
          host: { select: { fullName: true } },
          branch: { select: { name: true } },
        },
      });
      return {
        report,
        value,
        count: rows.length,
        rows: rows.map((v) => ({
          date: v.createdAt.toISOString().slice(0, 16).replace('T', ' '),
          visitor: v.visitor?.fullName ?? '—',
          phone: v.visitor?.phone ?? '—',
          company: v.visitor?.company ?? '—',
          host: v.host?.fullName ?? '—',
          branch: v.branch?.name ?? '—',
          status: v.status,
          purpose: v.purpose,
          vehicle: v.vehicleNumber ?? '—',
        })),
      };
    }

    if (report === 'workforce' || report === 'contractors') {
      const where: any = { checkIn: { gte: winFrom, lte: winTo }, ...attendanceScope(user) };
      if (f.branchId) where.branchId = f.branchId;
      const workerWhere: any = {};
      if (f.contractorId) workerWhere.contractorId = f.contractorId;
      if (report === 'contractors') workerWhere.contractor = { companyName: value };
      else if (!this.isTimeGroup(groupBy)) {
        if (groupBy === 'contractor') workerWhere.contractor = { companyName: value };
        else if (groupBy === 'worker') workerWhere.fullName = value;
        else if (groupBy === 'skill') workerWhere.skillCategory = value;
        else if (groupBy === 'branch') where.branch = { name: value };
      }
      if (Object.keys(workerWhere).length) where.worker = workerWhere;

      const rows = await this.prisma.attendance.findMany({
        where,
        take: TAKE,
        orderBy: { checkIn: 'desc' },
        select: {
          checkIn: true,
          checkOut: true,
          worker: {
            select: { fullName: true, skillCategory: true, contractor: { select: { companyName: true } } },
          },
          branch: { select: { name: true } },
        },
      });
      return {
        report,
        value,
        count: rows.length,
        rows: rows.map((a) => ({
          checkIn: a.checkIn.toISOString().slice(0, 16).replace('T', ' '),
          checkOut: a.checkOut ? a.checkOut.toISOString().slice(0, 16).replace('T', ' ') : '—',
          hours: a.checkOut ? this.round(Math.max(0, (a.checkOut.getTime() - a.checkIn.getTime()) / HOUR_MS)) : null,
          worker: a.worker?.fullName ?? '—',
          contractor: a.worker?.contractor?.companyName ?? '—',
          skill: a.worker?.skillCategory ?? '—',
          branch: a.branch?.name ?? '—',
        })),
      };
    }

    if (report === 'materials') {
      const where: any = { createdAt: { gte: winFrom, lte: winTo } };
      if (!isSuperAdmin(user)) where.visit = { branch: { organizationId: requireOrg(user) } };
      if (f.branchId) where.visit = { ...(where.visit || {}), branchId: f.branchId };
      if (groupBy === 'direction') where.direction = value;
      if (groupBy === 'branch') where.visit = { ...(where.visit || {}), branch: { name: value } };
      const rows = await this.prisma.materialGatePass.findMany({
        where,
        take: TAKE,
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          direction: true,
          description: true,
          quantity: true,
          serialNumber: true,
          recordedBy: true,
          visit: { select: { branch: { select: { name: true } }, visitor: { select: { fullName: true } } } },
        },
      });
      return {
        report,
        value,
        count: rows.length,
        rows: rows.map((p) => ({
          date: p.createdAt.toISOString().slice(0, 16).replace('T', ' '),
          direction: p.direction,
          description: p.description,
          quantity: p.quantity,
          serial: p.serialNumber ?? '—',
          branch: p.visit?.branch?.name ?? '—',
          visitor: p.visit?.visitor?.fullName ?? '—',
          recordedBy: p.recordedBy ?? '—',
        })),
      };
    }

    return { report, value, count: 0, rows: [] };
  }

  /** Render any grouped report to a flat row array (for server-side export/email). */
  async renderRows(user: JwtUser, report: string, f: ReportFilter): Promise<{ title: string; rows: any[] }> {
    let res: any;
    switch (report) {
      case 'visits': res = await this.visits(user, f); break;
      case 'workforce': res = await this.workforce(user, f); break;
      case 'contractors': res = await this.contractors(user, f); break;
      case 'branches': res = await this.branches(user, f); break;
      case 'users': res = await this.users(user, f); break;
      case 'materials': res = await this.materials(user, f); break;
      default: res = { rows: [] };
    }
    const title = report.charAt(0).toUpperCase() + report.slice(1);
    return { title, rows: res.rows ?? [] };
  }

  // ── Shared sorting: time buckets ascending, categorical by volume ──

  private sortRows(rows: any[], groupBy: string) {
    const isTime = ['day', 'week', 'month', 'year'].includes(groupBy);
    if (isTime) {
      rows.sort((a, b) => String(a.group).localeCompare(String(b.group)));
    } else {
      rows.sort((a, b) => (b.total ?? b.totalHours ?? b.inQty ?? 0) - (a.total ?? a.totalHours ?? a.inQty ?? 0));
    }
  }
}

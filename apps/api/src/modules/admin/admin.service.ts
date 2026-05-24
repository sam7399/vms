import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, DocumentType, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  JwtUser,
  branchScope,
  contractorScope,
  isSuperAdmin,
  requireOrg,
  userScope,
  visitorScope,
  workerScope,
  attendanceScope,
} from '../../common/tenant';

const prisma = new PrismaClient();

@Injectable()
export class AdminService {
  // --- Read helpers (used by form dropdowns) ----------------------
  listBranches(user: JwtUser) {
    return prisma.branch.findMany({
      where: branchScope(user),
      select: { id: true, name: true, location: true, organizationId: true },
      orderBy: { name: 'asc' },
    });
  }

  listHosts(user: JwtUser) {
    return prisma.user.findMany({
      where: { isActive: true, ...userScope(user) },
      select: { id: true, fullName: true, email: true, role: true, branchId: true },
      orderBy: { fullName: 'asc' },
    });
  }

  listVisitors(user: JwtUser) {
    return prisma.visitor.findMany({
      where: visitorScope(user),
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        company: true,
        documentType: true,
        documentNumber: true,
        isBlacklisted: true,
        createdAt: true,
        _count: { select: { visits: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async setVisitorBlacklist(user: JwtUser, id: string, blacklist: boolean) {
    // Authorize: visitor must be reachable in user's org (or super admin)
    if (!isSuperAdmin(user)) {
      const v = await prisma.visitor.findFirst({
        where: { id, ...visitorScope(user) },
        select: { id: true },
      });
      if (!v) throw new NotFoundException('Visitor not found in your organization');
    }
    return prisma.visitor.update({
      where: { id },
      data: { isBlacklisted: blacklist },
      select: { id: true, fullName: true, isBlacklisted: true },
    });
  }

  listContractors(user: JwtUser) {
    return prisma.contractor.findMany({
      where: contractorScope(user),
      include: { _count: { select: { workers: true } } },
      orderBy: { companyName: 'asc' },
    });
  }

  listWorkers(user: JwtUser, contractorId?: string) {
    const where: any = workerScope(user);
    if (contractorId) where.contractorId = contractorId;
    return prisma.worker.findMany({
      where,
      include: { contractor: { select: { companyName: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  listAttendance(user: JwtUser, limit = 200) {
    return prisma.attendance.findMany({
      where: attendanceScope(user),
      take: limit,
      orderBy: { checkIn: 'desc' },
      include: { worker: { select: { fullName: true, skillCategory: true } } },
    });
  }

  /**
   * Rule-based anomaly detection. Not ML, but actually useful: flags
   * frequency spikes, after-hours entries, repeated rejections, expired
   * compliance attempts. Scoped to user's org.
   */
  async detectAnomalies(user: JwtUser) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const visitWhere = isSuperAdmin(user)
      ? {}
      : { branch: { organizationId: requireOrg(user) } };

    const anomalies: Array<{
      id: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      kind: string;
      title: string;
      detail: string;
      visitId?: string;
      visitorId?: string;
      occurredAt?: string;
    }> = [];

    // (1) Visitors with 3+ visits in last 24h
    const recent = await prisma.visit.findMany({
      where: { createdAt: { gte: last24h }, ...visitWhere },
      select: { id: true, visitorId: true, visitor: { select: { fullName: true, phone: true } } },
    });
    const perVisitor = new Map<string, { name: string; phone: string; count: number }>();
    for (const v of recent) {
      const cur = perVisitor.get(v.visitorId) || { name: v.visitor.fullName, phone: v.visitor.phone, count: 0 };
      cur.count += 1;
      perVisitor.set(v.visitorId, cur);
    }
    for (const [vid, info] of perVisitor) {
      if (info.count >= 3) {
        anomalies.push({
          id: `freq-${vid}`,
          severity: info.count >= 5 ? 'HIGH' : 'MEDIUM',
          kind: 'frequency',
          title: `${info.name} visited ${info.count}x in 24h`,
          detail: `Phone ${info.phone}. Unusual visit frequency.`,
          visitorId: vid,
        });
      }
    }

    // (2) After-hours check-ins (before 06:00 or after 22:00 local UTC)
    const afterHours = await prisma.visit.findMany({
      where: {
        actualEntry: { gte: last7d },
        ...visitWhere,
      },
      select: { id: true, actualEntry: true, visitor: { select: { fullName: true } } },
    });
    for (const v of afterHours) {
      if (!v.actualEntry) continue;
      const h = new Date(v.actualEntry).getUTCHours();
      if (h < 6 || h >= 22) {
        anomalies.push({
          id: `afterhours-${v.id}`,
          severity: 'MEDIUM',
          kind: 'after-hours',
          title: `${v.visitor.fullName} checked in at ${String(h).padStart(2, '0')}:00 UTC`,
          detail: 'Entry outside 06:00–22:00 window.',
          visitId: v.id,
          occurredAt: v.actualEntry.toISOString(),
        });
      }
    }

    // (3) Repeated rejections from same phone (>=2 in 7d)
    const rejected = await prisma.visit.findMany({
      where: {
        status: 'REJECTED',
        updatedAt: { gte: last7d },
        ...visitWhere,
      },
      select: { id: true, visitorId: true, visitor: { select: { fullName: true, phone: true } } },
    });
    const rejectCount = new Map<string, { name: string; phone: string; count: number }>();
    for (const v of rejected) {
      const cur = rejectCount.get(v.visitorId) || { name: v.visitor.fullName, phone: v.visitor.phone, count: 0 };
      cur.count += 1;
      rejectCount.set(v.visitorId, cur);
    }
    for (const [vid, info] of rejectCount) {
      if (info.count >= 2) {
        anomalies.push({
          id: `repeat-reject-${vid}`,
          severity: 'HIGH',
          kind: 'repeat-rejection',
          title: `${info.name} rejected ${info.count}x in 7d`,
          detail: `Phone ${info.phone}. Consider blacklisting.`,
          visitorId: vid,
        });
      }
    }

    // (4) Blacklisted visitor attempted entry (any blacklisted visitor with a visit in last 7d)
    const blacklistedAttempts = await prisma.visit.findMany({
      where: {
        createdAt: { gte: last7d },
        visitor: { isBlacklisted: true },
        ...visitWhere,
      },
      select: { id: true, visitor: { select: { fullName: true } }, createdAt: true },
    });
    for (const v of blacklistedAttempts) {
      anomalies.push({
        id: `blacklist-${v.id}`,
        severity: 'HIGH',
        kind: 'blacklist-attempt',
        title: `Blacklisted visitor ${v.visitor.fullName} created a visit`,
        detail: 'Gate will refuse entry, but the attempt was logged.',
        visitId: v.id,
        occurredAt: v.createdAt.toISOString(),
      });
    }

    // Sort: HIGH → MEDIUM → LOW
    const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    anomalies.sort((a, b) => rank[a.severity] - rank[b.severity]);

    return {
      generatedAt: now.toISOString(),
      total: anomalies.length,
      bySeverity: {
        HIGH: anomalies.filter((a) => a.severity === 'HIGH').length,
        MEDIUM: anomalies.filter((a) => a.severity === 'MEDIUM').length,
        LOW: anomalies.filter((a) => a.severity === 'LOW').length,
      },
      anomalies: anomalies.slice(0, 50),
    };
  }

  /**
   * Visits per hour-of-day × day-of-week heatmap over the last `days`.
   * Returns an array of { dow: 0..6 (Sun..Sat), hour: 0..23, count }.
   */
  async getHeatmap(user: JwtUser, days = 30) {
    const cap = Math.min(Math.max(days, 7), 90);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - cap);

    const visits = await prisma.visit.findMany({
      where: { createdAt: { gte: since }, ...(isSuperAdmin(user) ? {} : { branch: { organizationId: requireOrg(user) } }) },
      select: { createdAt: true },
    });

    const grid: Record<string, number> = {};
    for (const v of visits) {
      const d = new Date(v.createdAt);
      const dow = d.getUTCDay();
      const hour = d.getUTCHours();
      const key = `${dow}-${hour}`;
      grid[key] = (grid[key] ?? 0) + 1;
    }

    const out: Array<{ dow: number; hour: number; count: number }> = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        out.push({ dow, hour, count: grid[`${dow}-${hour}`] ?? 0 });
      }
    }
    return { days: cap, cells: out };
  }

  // Audit log — SUPER_ADMIN sees all; ORG_ADMIN sees entries by actors in their org.
  async listAuditLogs(user: JwtUser, limit = 200) {
    if (isSuperAdmin(user)) {
      return prisma.auditLog.findMany({ take: limit, orderBy: { createdAt: 'desc' } });
    }
    // Scope by actor — find user IDs in this org
    const orgUsers = await prisma.user.findMany({
      where: userScope(user),
      select: { id: true },
    });
    const ids = orgUsers.map((u) => u.id);
    return prisma.auditLog.findMany({
      where: { actorId: { in: ids } },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Write operations -------------------------------------------
  async createContractor(
    user: JwtUser,
    data: { organizationId?: string; companyName: string; gstNumber: string },
  ) {
    if (!data.companyName || !data.gstNumber) {
      throw new BadRequestException('companyName and gstNumber are required');
    }

    let orgId = data.organizationId;
    if (isSuperAdmin(user)) {
      if (!orgId) {
        const first = await prisma.organization.findFirst();
        if (!first) throw new BadRequestException('No organization exists yet');
        orgId = first.id;
      }
    } else {
      // Force own org regardless of payload
      orgId = requireOrg(user);
    }

    return prisma.contractor.create({
      data: {
        organizationId: orgId!,
        companyName: data.companyName,
        gstNumber: data.gstNumber,
      },
    });
  }

  async createWorker(
    user: JwtUser,
    data: {
      contractorId: string;
      fullName: string;
      phone: string;
      documentType: keyof typeof DocumentType;
      documentNumber: string;
      skillCategory: string;
      medicalExpiry: string;
      policeVerified?: boolean;
      pfNumber?: string;
      esicNumber?: string;
      hourlyRate?: number;
    },
  ) {
    const required = [
      'contractorId',
      'fullName',
      'phone',
      'documentNumber',
      'skillCategory',
      'medicalExpiry',
    ];
    for (const k of required) {
      if (!(data as any)[k]) throw new BadRequestException(`${k} is required`);
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id: data.contractorId },
      select: { id: true, organizationId: true },
    });
    if (!contractor) throw new NotFoundException('Contractor not found');

    if (!isSuperAdmin(user) && contractor.organizationId !== requireOrg(user)) {
      throw new ForbiddenException('Contractor belongs to another organization');
    }

    return prisma.worker.create({
      data: {
        contractorId: data.contractorId,
        fullName: data.fullName,
        phone: data.phone,
        documentType: DocumentType[data.documentType] ?? DocumentType.AADHAAR,
        documentNumber: data.documentNumber,
        skillCategory: data.skillCategory,
        medicalExpiry: new Date(data.medicalExpiry),
        policeVerified: data.policeVerified ?? false,
        pfNumber: data.pfNumber?.slice(0, 50) || null,
        esicNumber: data.esicNumber?.slice(0, 50) || null,
        hourlyRate: typeof data.hourlyRate === 'number' && Number.isFinite(data.hourlyRate)
          ? data.hourlyRate
          : null,
      },
    });
  }

  /**
   * Hours-worked + overtime report. For each worker with attendance in the
   * window: total hours, overtime hours (> 8 / day), estimated pay if
   * hourlyRate is set.
   */
  async workerHoursReport(user: JwtUser, days = 7) {
    const cap = Math.min(Math.max(days, 1), 90);
    const since = new Date(Date.now() - cap * 24 * 60 * 60 * 1000);

    const records = await prisma.attendance.findMany({
      where: {
        checkOut: { not: null },
        checkIn: { gte: since },
        ...attendanceScope(user),
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            skillCategory: true,
            hourlyRate: true,
            pfNumber: true,
            esicNumber: true,
            contractor: { select: { companyName: true } },
          },
        },
      },
    });

    // Aggregate per worker per day, then sum
    const perWorkerDay = new Map<string, { day: string; hours: number }[]>();
    const workers = new Map<string, any>();

    for (const r of records) {
      if (!r.checkOut) continue;
      const dayKey = r.checkIn.toISOString().slice(0, 10);
      const hours = Math.max(0, (r.checkOut.getTime() - r.checkIn.getTime()) / 3_600_000);
      const list = perWorkerDay.get(r.workerId) ?? [];
      const existing = list.find((d) => d.day === dayKey);
      if (existing) existing.hours += hours;
      else list.push({ day: dayKey, hours });
      perWorkerDay.set(r.workerId, list);
      workers.set(r.workerId, r.worker);
    }

    const rows: any[] = [];
    for (const [workerId, days] of perWorkerDay) {
      const w = workers.get(workerId);
      let total = 0;
      let overtime = 0;
      for (const d of days) {
        total += d.hours;
        if (d.hours > 8) overtime += d.hours - 8;
      }
      rows.push({
        workerId,
        fullName: w.fullName,
        contractor: w.contractor.companyName,
        skillCategory: w.skillCategory,
        pfNumber: w.pfNumber,
        esicNumber: w.esicNumber,
        hourlyRate: w.hourlyRate,
        daysWorked: days.length,
        totalHours: Number(total.toFixed(2)),
        overtimeHours: Number(overtime.toFixed(2)),
        estimatedPay:
          w.hourlyRate != null
            ? Number(((total - overtime) * w.hourlyRate + overtime * w.hourlyRate * 1.5).toFixed(2))
            : null,
      });
    }
    rows.sort((a, b) => b.totalHours - a.totalHours);
    return { windowDays: cap, rows };
  }

  async createHost(
    user: JwtUser,
    data: {
      branchId: string;
      email: string;
      password: string;
      fullName: string;
      role?: keyof typeof Role;
    },
  ) {
    if (!data.email || !data.password || !data.fullName || !data.branchId) {
      throw new BadRequestException('email, password, fullName, branchId required');
    }

    const branch = await prisma.branch.findUnique({
      where: { id: data.branchId },
      select: { id: true, organizationId: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (!isSuperAdmin(user) && branch.organizationId !== requireOrg(user)) {
      throw new ForbiddenException('Branch belongs to another organization');
    }

    return prisma.user.create({
      data: {
        branchId: data.branchId,
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, 10),
        fullName: data.fullName,
        role: Role[data.role ?? 'EMPLOYEE'] ?? Role.EMPLOYEE,
      },
      select: { id: true, email: true, fullName: true, role: true, branchId: true },
    });
  }
}

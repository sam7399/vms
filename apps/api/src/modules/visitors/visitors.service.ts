import { Injectable } from '@nestjs/common';
import { PrismaClient, VisitStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { HeadcountGateway } from '../../gateways/headcount.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const prisma = new PrismaClient();

// Strip "data:image/jpeg;base64," prefix and convert to Buffer for Prisma Bytes.
// Returns undefined for empty input so Prisma leaves the column null.
function parsePhotoBase64(input?: string | null): Buffer | undefined {
  if (!input) return undefined;
  const cleaned = input.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  if (cleaned.length === 0) return undefined;
  try {
    return Buffer.from(cleaned, 'base64');
  } catch {
    return undefined;
  }
}

@Injectable()
export class VisitorsService {
  constructor(
    private readonly headcount: HeadcountGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async createVisit(data: any) {
    const qrToken = crypto.randomBytes(16).toString('hex');

    return prisma.visit.create({
      data: {
        visitorId: data.visitorId,
        branchId: data.branchId,
        hostId: data.hostId,
        purpose: data.purpose,
        expectedEntry: new Date(data.expectedEntry),
        vehicleNumber: data.vehicleNumber,
        qrCodeToken: qrToken,
        status: data.status === 'APPROVED' ? VisitStatus.APPROVED : VisitStatus.PENDING,
      },
    });
  }

  async getAllVisits(branchId?: string) {
    return prisma.visit.findMany({
      where: branchId ? { branchId } : {},
      include: {
        visitor: true,
        host: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingVisits() {
    return prisma.visit.findMany({
      where: { status: VisitStatus.PENDING },
      include: {
        visitor: true,
        host: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true, location: true } },
      },
      orderBy: { expectedEntry: 'asc' },
    });
  }

  /** Public visitor pass — exposed without auth so the visitor can open the link. */
  async getPublicPass(id: string) {
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        visitor: { select: { fullName: true, company: true, phone: true } },
        host: { select: { fullName: true, email: true } },
        branch: { select: { name: true, location: true } },
      },
    });
    if (!visit) return null;
    return {
      visitId: visit.id,
      qrCodeToken: visit.qrCodeToken,
      status: visit.status,
      purpose: visit.purpose,
      expectedEntry: visit.expectedEntry,
      actualEntry: visit.actualEntry,
      actualExit: visit.actualExit,
      vehicleNumber: visit.vehicleNumber,
      visitor: visit.visitor,
      host: visit.host,
      branch: visit.branch,
    };
  }

  /** List of vehicles seen — every visit with a vehicleNumber. */
  async listVehicles(limit = 200) {
    return prisma.visit.findMany({
      where: { vehicleNumber: { not: null } },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        vehicleNumber: true,
        status: true,
        expectedEntry: true,
        actualEntry: true,
        actualExit: true,
        visitor: { select: { fullName: true, phone: true, company: true } },
        branch: { select: { name: true } },
      },
    });
  }

  async getVisit(id: string) {
    return prisma.visit.findUnique({
      where: { id },
      include: {
        visitor: true,
        host: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async updateVisitStatus(id: string, status: string) {
    const updated = await prisma.visit.update({
      where: { id },
      data: { status: status as any },
      include: {
        visitor: { select: { fullName: true, email: true } },
        host: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    });

    // Fire-and-forget approval email — no-op if RESEND_API_KEY isn't set
    if (status === 'APPROVED' && updated.visitor.email) {
      const base = process.env.PUBLIC_WEB_URL || 'https://vms-web-theta.vercel.app';
      this.notifications
        .sendVisitorPassApproved({
          to: updated.visitor.email,
          visitorName: updated.visitor.fullName,
          hostName: updated.host.fullName,
          branchName: updated.branch.name,
          expectedEntry: updated.expectedEntry,
          passUrl: `${base}/pass/${updated.id}`,
        })
        .catch(() => {});
    }

    // Real-time push to dashboards
    if (status === 'APPROVED' || status === 'REJECTED') {
      this.headcount.broadcastNotification({
        kind: 'approval',
        title: `${updated.visitor.fullName} ${status.toLowerCase()}`,
        body: `Host: ${updated.host.fullName}`,
        visitId: updated.id,
      });
    }

    return updated;
  }

  async checkInVisitor(visitId: string) {
    const v = await prisma.visit.update({
      where: { id: visitId },
      data: { status: VisitStatus.CHECKED_IN, actualEntry: new Date() },
    });
    this.headcount.broadcastHeadcountUpdate().catch(() => {});
    return v;
  }

  async checkOutVisitor(visitId: string) {
    const v = await prisma.visit.update({
      where: { id: visitId },
      data: { status: VisitStatus.CHECKED_OUT, actualExit: new Date() },
    });
    this.headcount.broadcastHeadcountUpdate().catch(() => {});
    return v;
  }

  async createVisitor(data: any) {
    return prisma.visitor.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        company: data.company,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        faceData: parsePhotoBase64(data.photoBase64),
      },
    });
  }

  async getVisitors() {
    return prisma.visitor.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async getLiveHeadcount(branchId?: string) {
    const visitWhere = branchId
      ? { branchId, status: VisitStatus.CHECKED_IN, actualExit: null }
      : { status: VisitStatus.CHECKED_IN, actualExit: null };
    const attendanceWhere = branchId
      ? { branchId, checkOut: null }
      : { checkOut: null };

    const [activeVisits, workers] = await Promise.all([
      prisma.visit.findMany({
        where: visitWhere,
        select: { id: true, visitor: { select: { company: true } } },
      }),
      prisma.attendance.count({ where: attendanceWhere }),
    ]);

    const visitors = activeVisits.filter((v) => v.visitor.company).length;
    const employees = activeVisits.filter((v) => !v.visitor.company).length;

    return {
      total: visitors + employees + workers,
      visitors,
      workers,
      employees,
    };
  }
}

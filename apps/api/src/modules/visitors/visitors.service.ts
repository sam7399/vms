import { Injectable } from '@nestjs/common';
import { PrismaClient, VisitStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { HeadcountGateway } from '../../gateways/headcount.gateway';

const prisma = new PrismaClient();

@Injectable()
export class VisitorsService {
  constructor(private readonly headcount: HeadcountGateway) {}

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
        status: VisitStatus.PENDING,
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
    return prisma.visit.update({
      where: { id },
      data: { status: status as any },
    });
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

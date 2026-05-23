import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

@Injectable()
export class VisitorsService {
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
        status: 'PENDING',
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
    return prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'CHECKED_IN',
        actualEntry: new Date(),
      },
    });
  }

  async checkOutVisitor(visitId: string) {
    return prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'CHECKED_OUT',
        actualExit: new Date(),
      },
    });
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
    const where = branchId ? { branchId, status: 'CHECKED_IN' } : { status: 'CHECKED_IN' };

    const visits = await prisma.visit.findMany({
      where,
      include: { visitor: true },
    });

    const checkedInVisitors = visits.filter((v: any) => v.actualEntry && !v.actualExit);

    return {
      total: checkedInVisitors.length,
      visitors: checkedInVisitors.filter((v: any) => v.visitor.company).length,
      workers: 0,
      employees: checkedInVisitors.filter((v: any) => !v.visitor.company).length,
    };
  }
}

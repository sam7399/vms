import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, DocumentType, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

@Injectable()
export class AdminService {
  // --- Read helpers (used by form dropdowns) ----------------------
  listBranches() {
    return prisma.branch.findMany({
      select: { id: true, name: true, location: true, organizationId: true },
      orderBy: { name: 'asc' },
    });
  }

  listHosts() {
    return prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, email: true, role: true, branchId: true },
      orderBy: { fullName: 'asc' },
    });
  }

  listVisitors() {
    return prisma.visitor.findMany({
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        company: true,
        isBlacklisted: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  listContractors() {
    return prisma.contractor.findMany({
      include: { _count: { select: { workers: true } } },
      orderBy: { companyName: 'asc' },
    });
  }

  listWorkers(contractorId?: string) {
    return prisma.worker.findMany({
      where: contractorId ? { contractorId } : {},
      include: { contractor: { select: { companyName: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  listAttendance(limit = 200) {
    return prisma.attendance.findMany({
      take: limit,
      orderBy: { checkIn: 'desc' },
      include: { worker: { select: { fullName: true, skillCategory: true } } },
    });
  }

  listAuditLogs(limit = 200) {
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Write operations -------------------------------------------
  async createContractor(data: {
    organizationId?: string;
    companyName: string;
    gstNumber: string;
  }) {
    if (!data.companyName || !data.gstNumber) {
      throw new BadRequestException('companyName and gstNumber are required');
    }
    let orgId = data.organizationId;
    if (!orgId) {
      const first = await prisma.organization.findFirst();
      if (!first) throw new BadRequestException('No organization exists yet');
      orgId = first.id;
    }
    return prisma.contractor.create({
      data: {
        organizationId: orgId,
        companyName: data.companyName,
        gstNumber: data.gstNumber,
      },
    });
  }

  async createWorker(data: {
    contractorId: string;
    fullName: string;
    phone: string;
    documentType: keyof typeof DocumentType;
    documentNumber: string;
    skillCategory: string;
    medicalExpiry: string;
    policeVerified?: boolean;
  }) {
    const required = ['contractorId', 'fullName', 'phone', 'documentNumber', 'skillCategory', 'medicalExpiry'];
    for (const k of required) {
      if (!(data as any)[k]) throw new BadRequestException(`${k} is required`);
    }

    const contractor = await prisma.contractor.findUnique({ where: { id: data.contractorId } });
    if (!contractor) throw new NotFoundException('Contractor not found');

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
      },
    });
  }

  async createHost(data: {
    branchId: string;
    email: string;
    password: string;
    fullName: string;
    role?: keyof typeof Role;
  }) {
    if (!data.email || !data.password || !data.fullName || !data.branchId) {
      throw new BadRequestException('email, password, fullName, branchId required');
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

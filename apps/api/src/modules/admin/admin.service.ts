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
      },
    });
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

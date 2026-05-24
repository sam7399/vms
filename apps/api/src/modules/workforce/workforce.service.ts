import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  JwtUser,
  branchScope,
  isSuperAdmin,
  requireOrg,
  workerScope,
} from '../../common/tenant';

const prisma = new PrismaClient();

const TIME_RE = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

@Injectable()
export class WorkforceService {
  // --- Shifts -----------------------------------------------------
  listShifts(user: JwtUser) {
    return prisma.shift.findMany({
      where: { branch: branchScope(user) } as any,
      include: {
        branch: { select: { name: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: [{ branchId: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createShift(
    user: JwtUser,
    data: { branchId: string; name: string; startTime: string; endTime: string },
  ) {
    if (!data.branchId || !data.name || !data.startTime || !data.endTime) {
      throw new BadRequestException('branchId, name, startTime, endTime required');
    }
    if (!TIME_RE.test(data.startTime) || !TIME_RE.test(data.endTime)) {
      throw new BadRequestException('startTime / endTime must be HH:MM');
    }
    const branch = await prisma.branch.findUnique({
      where: { id: data.branchId },
      select: { organizationId: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (!isSuperAdmin(user) && branch.organizationId !== requireOrg(user)) {
      throw new ForbiddenException('Branch belongs to another organization');
    }
    return prisma.shift.create({
      data: {
        branchId: data.branchId,
        name: data.name.slice(0, 100),
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });
  }

  async assignWorkerToShift(user: JwtUser, shiftId: string, workerId: string) {
    if (!shiftId || !workerId) {
      throw new BadRequestException('shiftId and workerId required');
    }
    // Scope check
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, branch: branchScope(user) as any },
      select: { id: true, branchId: true },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    const worker = await prisma.worker.findFirst({
      where: { id: workerId, ...workerScope(user) },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    return prisma.workerShift.upsert({
      where: { workerId_shiftId: { workerId, shiftId } },
      update: {},
      create: { workerId, shiftId },
    });
  }

  async unassignWorker(user: JwtUser, shiftId: string, workerId: string) {
    // Verify shift is in scope
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, branch: branchScope(user) as any },
      select: { id: true },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    await prisma.workerShift.deleteMany({ where: { shiftId, workerId } });
    return { ok: true };
  }

  shiftAssignments(user: JwtUser, shiftId: string) {
    return prisma.workerShift.findMany({
      where: {
        shiftId,
        shift: { branch: branchScope(user) as any },
      } as any,
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            skillCategory: true,
            isActive: true,
            contractor: { select: { companyName: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // --- Parking slots ---------------------------------------------
  listParkingSlots(user: JwtUser) {
    return prisma.parkingSlot.findMany({
      where: { branch: branchScope(user) } as any,
      include: {
        branch: { select: { name: true } },
        visits: {
          where: { actualEntry: { not: null }, actualExit: null },
          select: {
            id: true,
            visitor: { select: { fullName: true } },
            vehicleNumber: true,
          },
        },
      },
      orderBy: [{ branchId: 'asc' }, { label: 'asc' }],
    });
  }

  async createParkingSlot(
    user: JwtUser,
    data: { branchId: string; label: string; zone?: string },
  ) {
    if (!data.branchId || !data.label) {
      throw new BadRequestException('branchId and label required');
    }
    const branch = await prisma.branch.findUnique({
      where: { id: data.branchId },
      select: { organizationId: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (!isSuperAdmin(user) && branch.organizationId !== requireOrg(user)) {
      throw new ForbiddenException('Branch belongs to another organization');
    }
    return prisma.parkingSlot.create({
      data: {
        branchId: data.branchId,
        label: data.label.slice(0, 50),
        zone: data.zone?.slice(0, 50) || null,
      },
    });
  }

  async assignSlotToVisit(user: JwtUser, visitId: string, slotId: string | null) {
    // Scope visit
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, branch: branchScope(user) as any },
      select: { id: true, branchId: true },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    if (slotId) {
      const slot = await prisma.parkingSlot.findFirst({
        where: { id: slotId, branchId: visit.branchId },
        select: { id: true },
      });
      if (!slot) throw new BadRequestException('Slot not in this visit\'s branch');
    }
    return prisma.visit.update({
      where: { id: visitId },
      data: { parkingSlotId: slotId },
      select: { id: true, parkingSlotId: true },
    });
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { EventBus } from '../../platform/events/event-bus';
import { JwtUser, isSuperAdmin, workerScope } from '../../common/tenant';

@Injectable()
export class GateService {
  constructor(
    private readonly events: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  private emitWorkerEvent(kind: 'in' | 'out', branchId: string, workerId: string, workerName: string) {
    const ts = new Date().toISOString();
    this.events.emit(kind === 'in' ? 'worker.checked_in' : 'worker.checked_out', {
      branchId,
      kind: 'worker',
      actorId: workerId,
      actorName: workerName,
      ts,
    });
    this.events.emit('headcount.invalidated', { branchId, reason: `worker.checked_${kind}`, ts });
  }

  /** Mark a worker on-site (creates Attendance if not already open). */
  async workerCheckIn(
    user: JwtUser,
    data: { workerId: string; gateId: string; branchId?: string },
  ) {
    if (!data.workerId || !data.gateId) {
      throw new BadRequestException('workerId and gateId are required');
    }

    const worker = await this.prisma.worker.findFirst({
      where: { id: data.workerId, ...workerScope(user) },
      include: { contractor: { select: { organizationId: true } } },
    });
    if (!worker) throw new NotFoundException('Worker not found in your organization');
    if (!worker.isActive) throw new BadRequestException('Worker is inactive');

    // Compliance gating
    if (!worker.policeVerified) {
      throw new BadRequestException('Worker is not police-verified yet');
    }
    if (new Date(worker.medicalExpiry) < new Date()) {
      throw new BadRequestException('Worker medical certificate has expired');
    }

    // Already inside? Return the open record without creating another.
    const open = await this.prisma.attendance.findFirst({
      where: { workerId: worker.id, checkOut: null },
    });
    if (open) {
      return { alreadyInside: true, attendanceId: open.id, workerName: worker.fullName };
    }

    // Resolve branchId — caller can pass it; otherwise pick the user's branch.
    let branchId = data.branchId;
    if (!branchId) {
      if (!user?.branchId) throw new BadRequestException('branchId required');
      branchId = user.branchId;
    } else if (!isSuperAdmin(user)) {
      // Authorize: branch must be in user's org
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { organizationId: true },
      });
      if (!branch || branch.organizationId !== (user as any).orgId) {
        throw new ForbiddenException('Branch belongs to another organization');
      }
    }

    const attendance = await this.prisma.attendance.create({
      data: {
        workerId: worker.id,
        branchId,
        gateId: data.gateId,
        checkIn: new Date(),
      },
    });

    this.emitWorkerEvent('in', branchId, worker.id, worker.fullName);

    return {
      success: true,
      attendanceId: attendance.id,
      workerId: worker.id,
      workerName: worker.fullName,
      checkedInAt: attendance.checkIn,
    };
  }

  /**
   * Worker check-in/out by their permanent QR token. Public surface
   * for the kiosk + mobile to scan a worker badge. Idempotent toggle:
   * if worker is currently on-site, it checks them out; otherwise in.
   */
  async workerQrToggle(token: string, gateId = 'kiosk', branchId?: string) {
    if (!token) throw new BadRequestException('Token required');
    const worker = await this.prisma.worker.findUnique({
      where: { qrCodeToken: token },
      include: { contractor: { select: { companyName: true } } },
    });
    if (!worker) throw new NotFoundException('Unknown worker QR');
    if (!worker.isActive) throw new BadRequestException('Worker is inactive');

    const open = await this.prisma.attendance.findFirst({
      where: { workerId: worker.id, checkOut: null },
    });

    if (open) {
      const updated = await this.prisma.attendance.update({
        where: { id: open.id },
        data: { checkOut: new Date() },
      });
      this.emitWorkerEvent('out', updated.branchId, worker.id, worker.fullName);
      return {
        action: 'checked-out',
        workerName: worker.fullName,
        contractor: worker.contractor.companyName,
        checkedInAt: updated.checkIn,
        checkedOutAt: updated.checkOut,
      };
    }

    // Compliance gate
    if (!worker.policeVerified) {
      throw new BadRequestException('Worker is not police-verified yet');
    }
    if (new Date(worker.medicalExpiry) < new Date()) {
      throw new BadRequestException('Worker medical certificate has expired');
    }

    const chosenBranch = branchId ?? (await this.prisma.branch.findFirst())?.id;
    if (!chosenBranch) throw new BadRequestException('No branch available');

    const att = await this.prisma.attendance.create({
      data: {
        workerId: worker.id,
        branchId: chosenBranch,
        gateId,
        checkIn: new Date(),
      },
    });
    this.emitWorkerEvent('in', chosenBranch, worker.id, worker.fullName);
    return {
      action: 'checked-in',
      workerName: worker.fullName,
      contractor: worker.contractor.companyName,
      attendanceId: att.id,
      checkedInAt: att.checkIn,
    };
  }

  /** Mark a worker as leaving (close open Attendance). */
  async workerCheckOut(user: JwtUser, workerId: string) {
    if (!workerId) throw new BadRequestException('workerId is required');

    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, ...workerScope(user) },
      select: { id: true, fullName: true, skillCategory: true },
    });
    if (!worker) throw new NotFoundException('Worker not found in your organization');

    const open = await this.prisma.attendance.findFirst({
      where: { workerId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });
    if (!open) {
      throw new BadRequestException('Worker is not currently checked in');
    }

    const updated = await this.prisma.attendance.update({
      where: { id: open.id },
      data: { checkOut: new Date() },
    });

    this.emitWorkerEvent('out', updated.branchId, worker.id, worker.fullName);

    return {
      success: true,
      attendanceId: updated.id,
      workerName: worker.fullName,
      checkedInAt: updated.checkIn,
      checkedOutAt: updated.checkOut,
    };
  }

  // Mock face embedding comparison (in production, use TensorFlow/OpenCV)
  private compareFaceEmbeddings(embedding1: any, embedding2: any): number {
    if (!embedding1 || !embedding2) return 0;
    return Math.random() * 0.3 + 0.7; // Mock: 70-100% similarity
  }

  async processFaceEntry(gateId: string, branchId: string, capturedEmbedding: Buffer) {
    const CONFIDENCE_THRESHOLD = 0.85;

    // Get active workers
    const activeWorkers = await this.prisma.worker.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        faceData: true,
        medicalExpiry: true,
        policeVerified: true,
        contractorId: true,
      },
    });

    let matchedWorker = null;
    for (const worker of activeWorkers) {
      if (worker.faceData) {
        const similarity = this.compareFaceEmbeddings(capturedEmbedding, worker.faceData);
        if (similarity >= CONFIDENCE_THRESHOLD) {
          matchedWorker = worker;
          break;
        }
      }
    }

    if (!matchedWorker) {
      return { success: false, message: 'Face not recognized' };
    }

    // Check compliance
    if (!matchedWorker.policeVerified) {
      return { success: false, message: 'Police verification incomplete' };
    }

    if (new Date() > matchedWorker.medicalExpiry) {
      return { success: false, message: 'Medical certificate expired' };
    }

    // Log attendance
    const attendance = await this.prisma.attendance.create({
      data: {
        workerId: matchedWorker.id,
        branchId,
        gateId,
        checkIn: new Date(),
      },
    });

    return {
      success: true,
      message: 'Access granted',
      workerId: matchedWorker.id,
      workerName: matchedWorker.fullName,
      attendanceId: attendance.id,
    };
  }

  async checkInByQrToken(qrCodeToken: string) {
    if (!qrCodeToken?.trim()) {
      throw new BadRequestException('qrCodeToken is required');
    }

    const visit = await this.prisma.visit.findUnique({
      where: { qrCodeToken },
      include: { visitor: true },
    });

    if (!visit) {
      // Maybe it's a worker badge QR — try that route before failing
      const worker = await this.prisma.worker.findUnique({ where: { qrCodeToken } });
      if (worker) {
        return this.workerQrToggle(qrCodeToken);
      }
      throw new NotFoundException('Invalid QR token');
    }

    // Blacklist check — visitor record OR visit status
    if (visit.visitor.isBlacklisted) {
      throw new BadRequestException(
        `Visitor ${visit.visitor.fullName} is blacklisted — entry denied`,
      );
    }

    if (visit.status === VisitStatus.CHECKED_IN) {
      return {
        success: true,
        already: true,
        visitorName: visit.visitor.fullName,
        visitId: visit.id,
        checkedInAt: visit.actualEntry,
      };
    }

    if (visit.status === VisitStatus.REJECTED || visit.status === VisitStatus.BLACKLISTED) {
      throw new BadRequestException(`Visit is ${visit.status}`);
    }

    if (visit.status === VisitStatus.PENDING) {
      throw new BadRequestException(
        'Visit is still awaiting host approval — ask your host to approve first',
      );
    }

    const updated = await this.prisma.visit.update({
      where: { id: visit.id },
      data: {
        status: VisitStatus.CHECKED_IN,
        actualEntry: new Date(),
      },
    });

    const ts = new Date().toISOString();
    this.events.emit('visit.checked_in', {
      branchId: updated.branchId,
      kind: 'visitor',
      actorId: visit.visitorId,
      actorName: visit.visitor.fullName,
      ts,
    });
    this.events.emit('headcount.invalidated', { branchId: updated.branchId, reason: 'gate.qr_checkin', ts });

    return {
      success: true,
      visitorName: visit.visitor.fullName,
      visitId: updated.id,
      checkedInAt: updated.actualEntry,
    };
  }

  async getGateLog(gateId: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.prisma.attendance.findMany({
      where: {
        gateId,
        checkIn: { gte: since },
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            skillCategory: true,
          },
        },
      },
      orderBy: { checkIn: 'desc' },
    });
  }
}

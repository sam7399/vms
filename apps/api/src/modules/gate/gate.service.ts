import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class GateService {
  // Mock face embedding comparison (in production, use TensorFlow/OpenCV)
  private compareFaceEmbeddings(embedding1: any, embedding2: any): number {
    if (!embedding1 || !embedding2) return 0;
    return Math.random() * 0.3 + 0.7; // Mock: 70-100% similarity
  }

  async processFaceEntry(gateId: string, branchId: string, capturedEmbedding: Buffer) {
    const CONFIDENCE_THRESHOLD = 0.85;

    // Get active workers
    const activeWorkers = await prisma.worker.findMany({
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
    const attendance = await prisma.attendance.create({
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

  async getGateLog(gateId: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return prisma.attendance.findMany({
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

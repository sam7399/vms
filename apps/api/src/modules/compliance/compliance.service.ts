import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class ComplianceService {
  async getWorkerCompliance(workerId: string) {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
    });

    if (!worker) {
      return null;
    }

    const now = new Date();
    const medicalExpired = worker.medicalExpiry < now;

    return {
      workerId: worker.id,
      fullName: worker.fullName,
      medicalStatus: medicalExpired ? 'EXPIRED' : 'VALID',
      medicalExpiry: worker.medicalExpiry,
      policeVerified: worker.policeVerified,
      documentType: worker.documentType,
      documentNumber: worker.documentNumber,
      overallCompliance: worker.policeVerified && !medicalExpired ? 'COMPLIANT' : 'NON_COMPLIANT',
    };
  }

  async getContractorCompliance(contractorId: string) {
    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorId },
    });

    if (!contractor) {
      return null;
    }

    const workers = await prisma.worker.findMany({
      where: { contractorId },
    });

    const now = new Date();
    const compliantWorkers = workers.filter(
      (w: any) => w.policeVerified && w.medicalExpiry > now
    ).length;

    const complianceScore = workers.length > 0 ? (compliantWorkers / workers.length) * 100 : 0;

    return {
      contractorId: contractor.id,
      companyName: contractor.companyName,
      gstNumber: contractor.gstNumber,
      totalWorkers: workers.length,
      compliantWorkers,
      complianceScore: Math.round(complianceScore),
      status: complianceScore >= 80 ? 'COMPLIANT' : 'WARNING',
    };
  }

  async getAllComplianceStatus() {
    const contractors = await prisma.contractor.findMany({
      include: { workers: true },
    });

    const now = new Date();

    return contractors.map((c: any) => {
      const compliantWorkers = c.workers.filter(
        (w: any) => w.policeVerified && w.medicalExpiry > now
      ).length;
      const score = c.workers.length > 0 ? (compliantWorkers / c.workers.length) * 100 : 0;

      return {
        contractorId: c.id,
        companyName: c.companyName,
        totalWorkers: c.workers.length,
        compliantWorkers,
        complianceScore: Math.round(score),
        status: score >= 80 ? 'COMPLIANT' : 'WARNING',
      };
    });
  }

  async updateWorkerCompliance(workerId: string, data: any) {
    return prisma.worker.update({
      where: { id: workerId },
      data: {
        policeVerified: data.policeVerified !== undefined ? data.policeVerified : undefined,
        medicalExpiry: data.medicalExpiry ? new Date(data.medicalExpiry) : undefined,
      },
    });
  }
}

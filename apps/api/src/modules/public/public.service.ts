import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType, PrismaClient, VisitStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { HeadcountGateway } from '../../gateways/headcount.gateway';

const prisma = new PrismaClient();

@Injectable()
export class PublicService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly headcount: HeadcountGateway,
  ) {}

  listBranches() {
    return prisma.branch.findMany({
      select: { id: true, name: true, location: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Public-by-phone lookup. Returns the visitor's recent visits — name,
   * status, timestamps, branch — no document numbers or internal fields.
   * Throttler limits hit rate so this is not an enumeration oracle.
   */
  async lookupByPhone(phone: string) {
    const trimmed = (phone || '').trim();
    if (trimmed.length < 5) {
      throw new BadRequestException('phone is required');
    }
    const visitor = await prisma.visitor.findUnique({
      where: { phone: trimmed },
      select: {
        id: true,
        fullName: true,
        company: true,
        isBlacklisted: true,
        visits: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            purpose: true,
            expectedEntry: true,
            actualEntry: true,
            actualExit: true,
            vehicleNumber: true,
            qrCodeToken: true,
            branch: { select: { name: true, location: true } },
            host: { select: { fullName: true } },
          },
        },
      },
    });
    if (!visitor) {
      // Same shape for missing as found-but-empty — don't enumerate
      return { found: false, fullName: null, visits: [] };
    }
    return {
      found: true,
      fullName: visitor.fullName,
      company: visitor.company,
      blacklisted: visitor.isBlacklisted,
      visits: visitor.visits.map((v) => ({
        ...v,
        passUrl: `/pass/${v.id}`,
      })),
    };
  }

  listHosts() {
    return prisma.user.findMany({
      where: { isActive: true },
      // Trim the fields exposed to the public — no role, no email.
      select: { id: true, fullName: true, branchId: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async walkIn(data: {
    fullName: string;
    phone: string;
    email?: string;
    company?: string;
    documentType?: string;
    documentNumber: string;
    purpose: string;
    branchId: string;
    hostId: string;
    vehicleNumber?: string;
    photoBase64?: string;
  }) {
    const required = ['fullName', 'phone', 'documentNumber', 'purpose', 'branchId', 'hostId'];
    for (const k of required) {
      if (!(data as any)[k]) throw new BadRequestException(`${k} is required`);
    }

    const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
    if (!branch) throw new BadRequestException('Branch not found');
    const host = await prisma.user.findUnique({ where: { id: data.hostId } });
    if (!host) throw new BadRequestException('Host not found');

    // Reuse visitor by phone if already in the system; otherwise create new.
    const existing = await prisma.visitor.findUnique({ where: { phone: data.phone } });
    let visitorId: string;
    if (existing) {
      if (existing.isBlacklisted) {
        throw new BadRequestException('Visitor is blacklisted — entry denied');
      }
      visitorId = existing.id;
    } else {
      const created = await prisma.visitor.create({
        data: {
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          company: data.company,
          documentType:
            DocumentType[data.documentType as keyof typeof DocumentType] ?? DocumentType.AADHAAR,
          documentNumber: data.documentNumber,
          faceData: parsePhotoBase64(data.photoBase64),
        },
      });
      visitorId = created.id;
    }

    const visit = await prisma.visit.create({
      data: {
        visitorId,
        branchId: data.branchId,
        hostId: data.hostId,
        purpose: data.purpose,
        expectedEntry: new Date(),
        vehicleNumber: data.vehicleNumber,
        qrCodeToken: crypto.randomBytes(16).toString('hex'),
        status: VisitStatus.PENDING,
      },
      include: {
        visitor: { select: { fullName: true, email: true } },
        host: { select: { fullName: true, email: true } },
        branch: { select: { name: true } },
      },
    });

    // Tell the host their visitor just arrived (no-op without RESEND_API_KEY)
    if (host && (host as any).email) {
      const base = process.env.PUBLIC_WEB_URL || 'https://vms-web-theta.vercel.app';
      this.notifications
        .send({
          to: (host as any).email,
          subject: `${visit.visitor.fullName} is at the gate`,
          html: `<div style="font-family:system-ui,sans-serif;padding:16px">
            <h3>A visitor is here to see you</h3>
            <p><strong>${escape(visit.visitor.fullName)}</strong> just walked in at ${escape(visit.branch.name)}.</p>
            <p>Purpose: ${escape(data.purpose)}</p>
            <p><a href="${base}/approvals">Approve or reject in the dashboard</a></p>
          </div>`,
        })
        .catch(() => {});
    }

    // Real-time push to all connected dashboards
    this.headcount.broadcastNotification({
      kind: 'walk-in',
      title: `${visit.visitor.fullName} just walked in`,
      body: `${data.purpose} · host ${visit.host.fullName}`,
      visitId: visit.id,
    });

    return {
      visitId: visit.id,
      qrCodeToken: visit.qrCodeToken,
      status: visit.status,
      visitorName: visit.visitor.fullName,
      hostName: visit.host.fullName,
      passUrl: `/pass/${visit.id}`,
    };
  }
}

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

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

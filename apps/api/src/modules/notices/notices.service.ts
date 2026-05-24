import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { HeadcountGateway } from '../../gateways/headcount.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtUser, isSuperAdmin } from '../../common/tenant';

const prisma = new PrismaClient();

const LEVELS = new Set(['info', 'warning', 'urgent']);

@Injectable()
export class NoticesService {
  constructor(
    private readonly headcount: HeadcountGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /** Notices the calling user should see right now. */
  async list(user: JwtUser, branchId?: string) {
    const now = new Date();
    const where: any = {
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    };

    if (isSuperAdmin(user)) {
      if (branchId) where.AND.push({ OR: [{ branchId }, { branchId: null }] });
    } else {
      const orgId = (user as any).orgId;
      const userBranch = (user as any).branchId;
      // user sees: org-wide notices for their org + branch-specific for their branch + global SUPER_ADMIN notices (orgId null)
      where.AND.push({
        OR: [
          { organizationId: orgId, branchId: null },
          { organizationId: orgId, branchId: userBranch },
          { organizationId: null, branchId: null },
        ],
      });
    }

    return prisma.notice.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async create(
    user: JwtUser,
    data: { title: string; body: string; level?: string; branchId?: string | null; expiresAt?: string | null },
  ) {
    if (!data?.title?.trim() || !data?.body?.trim()) {
      throw new BadRequestException('title and body are required');
    }
    const level = LEVELS.has(data.level || '') ? (data.level as string) : 'info';

    // Scope authorization: ORG_ADMIN can only post to their own org/branch.
    let orgId: string | null = null;
    if (!isSuperAdmin(user)) {
      orgId = (user as any).orgId ?? null;
      if (data.branchId) {
        const b = await prisma.branch.findUnique({
          where: { id: data.branchId },
          select: { organizationId: true },
        });
        if (!b || b.organizationId !== orgId) {
          throw new ForbiddenException('Branch belongs to another organization');
        }
      }
    }

    const me = await prisma.user.findUnique({
      where: { id: (user as any).id },
      select: { fullName: true, email: true, branch: { select: { organizationId: true } } },
    });
    if (!isSuperAdmin(user) && me?.branch?.organizationId) {
      orgId = me.branch.organizationId;
    }

    const notice = await prisma.notice.create({
      data: {
        title: data.title.trim().slice(0, 200),
        body: data.body.trim().slice(0, 2000),
        level,
        organizationId: orgId,
        branchId: data.branchId || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        authorId: (user as any).id ?? 'unknown',
        authorName: me?.fullName ?? me?.email ?? 'Admin',
      },
    });

    // Real-time broadcast to dashboards
    this.headcount.broadcastNotice(notice);

    // Mobile push to everyone affected
    this.notifications
      .pushToDevices({
        title: `📢 ${notice.title}`,
        body: notice.body.slice(0, 120),
        data: { kind: 'notice', noticeId: notice.id },
        branchId: notice.branchId ?? undefined,
        orgId: notice.organizationId ?? undefined,
      })
      .catch(() => {});

    return notice;
  }

  async remove(user: JwtUser, id: string) {
    const existing = await prisma.notice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notice not found');
    if (!isSuperAdmin(user)) {
      const orgId = (user as any).orgId;
      if (existing.organizationId && existing.organizationId !== orgId) {
        throw new ForbiddenException('Notice belongs to another organization');
      }
    }
    await prisma.notice.delete({ where: { id } });
    this.headcount.broadcastNoticeRemoved(id);
    return { ok: true };
  }
}

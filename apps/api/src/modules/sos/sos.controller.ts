import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HeadcountGateway } from '../../gateways/headcount.gateway';
import type { JwtUser } from '../../common/tenant';

const prisma = new PrismaClient();

@Controller('sos')
@UseGuards(JwtAuthGuard)
export class SosController {
  constructor(private readonly headcount: HeadcountGateway) {}

  @Post('trigger')
  async trigger(@CurrentUser() user: JwtUser, @Body() body: { message?: string }) {
    const me = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true, branch: { select: { name: true } } },
    });
    this.headcount.broadcastSos({
      actorEmail: me?.email ?? user.email,
      actorName: me?.fullName ?? user.email,
      branchName: me?.branch?.name,
      message: body?.message?.slice(0, 200),
    });
    return { ok: true };
  }

  @Post('clear')
  async clear() {
    this.headcount.broadcastSosClear();
    return { ok: true };
  }
}

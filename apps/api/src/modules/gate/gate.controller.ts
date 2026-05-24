import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GateService } from './gate.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';

@Controller('gate')
export class GateController {
  constructor(private gateService: GateService) {}

  // Public — kiosk + mobile use this
  @Post('face-entry')
  async processFaceEntry(
    @Body() body: { gateId: string; branchId: string; capturedEmbedding: Buffer },
  ) {
    return this.gateService.processFaceEntry(
      body.gateId,
      body.branchId,
      body.capturedEmbedding,
    );
  }

  // Public — kiosk + mobile use this
  @Post('check-in')
  async checkIn(@Body() body: { qrCodeToken: string }) {
    return this.gateService.checkInByQrToken(body.qrCodeToken);
  }

  @Get('log/:gateId')
  @UseGuards(JwtAuthGuard)
  async getGateLog(@Param('gateId') gateId: string) {
    return this.gateService.getGateLog(gateId, 24);
  }

  // Worker check-in / check-out — auth required, security/HR/supervisor roles
  @Post('worker-check-in')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.HR_MANAGER,
    Role.SECURITY_GUARD,
    Role.CONTRACTOR_SUPERVISOR,
  )
  workerCheckIn(
    @CurrentUser() user: JwtUser,
    @Body() body: { workerId: string; gateId: string; branchId?: string },
  ) {
    return this.gateService.workerCheckIn(user, body);
  }

  @Post('worker-check-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.HR_MANAGER,
    Role.SECURITY_GUARD,
    Role.CONTRACTOR_SUPERVISOR,
  )
  workerCheckOut(
    @CurrentUser() user: JwtUser,
    @Body() body: { workerId: string },
  ) {
    return this.gateService.workerCheckOut(user, body?.workerId);
  }
}

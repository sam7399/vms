import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { GateService } from './gate.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('gate')
export class GateController {
  constructor(private gateService: GateService) {}

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

  @Post('check-in')
  async checkIn(@Body() body: { qrCodeToken: string }) {
    return this.gateService.checkInByQrToken(body.qrCodeToken);
  }

  @Get('log/:gateId')
  @UseGuards(JwtAuthGuard)
  async getGateLog(@Param('gateId') gateId: string) {
    return this.gateService.getGateLog(gateId, 24);
  }
}

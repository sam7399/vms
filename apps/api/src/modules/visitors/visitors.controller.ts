import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('visitors')
export class VisitorsController {
  constructor(private visitorsService: VisitorsService) {}

  @Get()
  async getVisitors() {
    return this.visitorsService.getVisitors();
  }

  @Get('visits')
  async getAllVisits() {
    return this.visitorsService.getAllVisits();
  }

  @Get('headcount')
  async getHeadcountDefault() {
    return this.visitorsService.getLiveHeadcount();
  }

  @Post()
  async createVisitor(@Body() body: any) {
    return this.visitorsService.createVisitor(body);
  }

  @Post('visit')
  async createVisit(@Body() body: any, @CurrentUser() user: any) {
    return this.visitorsService.createVisit(body);
  }

  @Get('headcount/:branchId')
  async getHeadcount(@Param('branchId') branchId: string) {
    return this.visitorsService.getLiveHeadcount(branchId);
  }

  @Get('visit/list/:branchId')
  async getVisitsByBranch(@Param('branchId') branchId: string) {
    return this.visitorsService.getAllVisits(branchId);
  }

  @Get('visit/:id')
  async getVisit(@Param('id') id: string) {
    return this.visitorsService.getVisit(id);
  }

  @Put('visit/:id/checkin')
  async checkIn(@Param('id') id: string) {
    return this.visitorsService.checkInVisitor(id);
  }

  @Put('visit/:id/checkout')
  async checkOut(@Param('id') id: string) {
    return this.visitorsService.checkOutVisitor(id);
  }

  @Put('visit/:id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.visitorsService.updateVisitStatus(id, body.status);
  }
}

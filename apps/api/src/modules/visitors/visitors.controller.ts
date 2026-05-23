import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { VisitorsService } from './visitors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('visitors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitorsController {
  constructor(private visitorsService: VisitorsService) {}

  // --- Reads --------------------------------------------------
  @Get()
  getVisitors() {
    return this.visitorsService.getVisitors();
  }

  @Get('visits')
  getAllVisits() {
    return this.visitorsService.getAllVisits();
  }

  @Get('pending')
  getPendingVisits() {
    return this.visitorsService.getPendingVisits();
  }

  @Get('vehicles')
  listVehicles() {
    return this.visitorsService.listVehicles();
  }

  @Get('headcount')
  getHeadcountDefault() {
    return this.visitorsService.getLiveHeadcount();
  }

  @Get('headcount/:branchId')
  getHeadcount(@Param('branchId') branchId: string) {
    return this.visitorsService.getLiveHeadcount(branchId);
  }

  @Get('visit/list/:branchId')
  getVisitsByBranch(@Param('branchId') branchId: string) {
    return this.visitorsService.getAllVisits(branchId);
  }

  @Get('visit/:id')
  getVisit(@Param('id') id: string) {
    return this.visitorsService.getVisit(id);
  }

  // --- Writes -------------------------------------------------
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.RECEPTIONIST)
  createVisitor(@Body() body: any) {
    return this.visitorsService.createVisitor(body);
  }

  @Post('visit')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.RECEPTIONIST, Role.EMPLOYEE)
  createVisit(@Body() body: any) {
    return this.visitorsService.createVisit(body);
  }

  @Put('visit/:id/checkin')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_GUARD, Role.RECEPTIONIST)
  checkIn(@Param('id') id: string) {
    return this.visitorsService.checkInVisitor(id);
  }

  @Put('visit/:id/checkout')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_GUARD, Role.RECEPTIONIST)
  checkOut(@Param('id') id: string) {
    return this.visitorsService.checkOutVisitor(id);
  }

  @Put('visit/:id/status')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.visitorsService.updateVisitStatus(id, body.status);
  }
}

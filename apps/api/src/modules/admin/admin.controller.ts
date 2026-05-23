import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // --- Reads: any authenticated user -----------------------------
  @Get('branches')
  branches() {
    return this.admin.listBranches();
  }

  @Get('hosts')
  hosts() {
    return this.admin.listHosts();
  }

  @Get('visitors')
  visitors() {
    return this.admin.listVisitors();
  }

  @Get('contractors')
  contractors() {
    return this.admin.listContractors();
  }

  @Get('workers')
  workers(@Query('contractorId') contractorId?: string) {
    return this.admin.listWorkers(contractorId);
  }

  @Get('attendance')
  attendance() {
    return this.admin.listAttendance();
  }

  @Get('audit')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  audit() {
    return this.admin.listAuditLogs();
  }

  // --- Writes: admin / HR only -----------------------------------
  @Post('contractors')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  createContractor(@Body() body: any) {
    return this.admin.createContractor(body);
  }

  @Post('workers')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.CONTRACTOR_SUPERVISOR)
  createWorker(@Body() body: any) {
    return this.admin.createWorker(body);
  }

  @Post('hosts')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  createHost(@Body() body: any) {
    return this.admin.createHost(body);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService, ReportFilter } from './reports.service';
import { ReportScheduleService, ScheduleInput } from './report-schedule.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';

// All endpoints are org-scoped via the service (SUPER_ADMIN sees everything).
// Common query params: from, to (ISO date), branchId, contractorId, groupBy.
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly schedules: ReportScheduleService,
  ) {}

  private filter(q: Record<string, string | undefined>): ReportFilter {
    return {
      from: q.from,
      to: q.to,
      branchId: q.branchId,
      contractorId: q.contractorId,
      groupBy: q.groupBy,
    };
  }

  @Get('overview')
  overview(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.overview(user, this.filter(q));
  }

  @Get('visits')
  visits(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.visits(user, this.filter(q));
  }

  @Get('workforce')
  workforce(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.workforce(user, this.filter(q));
  }

  @Get('contractors')
  contractors(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.contractors(user, this.filter(q));
  }

  @Get('branches')
  branches(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.branches(user, this.filter(q));
  }

  @Get('users')
  users(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.users(user, this.filter(q));
  }

  @Get('materials')
  materials(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.materials(user, this.filter(q));
  }

  // ── Drill-down: raw records behind a grouped row ──────────────────
  @Get(':report/detail')
  detail(
    @CurrentUser() user: JwtUser,
    @Param('report') report: string,
    @Query() q: Record<string, string>,
  ) {
    return this.reports.detail(user, report, this.filter(q), q.value ?? '');
  }

  // ── Scheduled email reports ───────────────────────────────────────
  @Get('schedules/list')
  listSchedules(@CurrentUser() user: JwtUser) {
    return this.schedules.list(user);
  }

  @Post('schedules')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD)
  createSchedule(@CurrentUser() user: JwtUser, @Body() body: ScheduleInput) {
    return this.schedules.create(user, body);
  }

  @Put('schedules/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD)
  updateSchedule(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Partial<ScheduleInput>) {
    return this.schedules.update(user, id, body);
  }

  @Delete('schedules/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD)
  deleteSchedule(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.schedules.remove(user, id);
  }

  @Post('schedules/:id/run')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD)
  runSchedule(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.schedules.runNow(user, id);
  }
}

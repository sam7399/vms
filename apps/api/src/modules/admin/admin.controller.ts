import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

// NOTE: These routes are intentionally unguarded for the demo dashboard.
// Re-add JwtAuthGuard + role checks once real auth is fully wired on the web.
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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

  @Post('contractors')
  createContractor(@Body() body: any) {
    return this.admin.createContractor(body);
  }

  @Post('workers')
  createWorker(@Body() body: any) {
    return this.admin.createWorker(body);
  }

  @Post('hosts')
  createHost(@Body() body: any) {
    return this.admin.createHost(body);
  }
}

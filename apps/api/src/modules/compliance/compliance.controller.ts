import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Get()
  getAllCompliance() {
    return this.complianceService.getAllComplianceStatus();
  }

  @Get('alerts')
  getAlerts() {
    return this.complianceService.getExpiringSoon(30);
  }

  @Get('worker/:workerId')
  getWorkerCompliance(@Param('workerId') workerId: string) {
    return this.complianceService.getWorkerCompliance(workerId);
  }

  @Get('contractor/:contractorId')
  getContractorCompliance(@Param('contractorId') contractorId: string) {
    return this.complianceService.getContractorCompliance(contractorId);
  }

  @Put('worker/:workerId')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  updateWorkerCompliance(
    @Param('workerId') workerId: string,
    @Body() body: any,
  ) {
    return this.complianceService.updateWorkerCompliance(workerId, body);
  }
}

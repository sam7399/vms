import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('compliance')
@UseGuards(JwtAuthGuard)
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Get('worker/:workerId')
  async getWorkerCompliance(@Param('workerId') workerId: string) {
    return this.complianceService.getWorkerCompliance(workerId);
  }

  @Get('contractor/:contractorId')
  async getContractorCompliance(@Param('contractorId') contractorId: string) {
    return this.complianceService.getContractorCompliance(contractorId);
  }

  @Get()
  async getAllCompliance() {
    return this.complianceService.getAllComplianceStatus();
  }

  @Put('worker/:workerId')
  async updateWorkerCompliance(
    @Param('workerId') workerId: string,
    @Body() body: any
  ) {
    return this.complianceService.updateWorkerCompliance(workerId, body);
  }
}

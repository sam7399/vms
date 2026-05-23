import { Module } from '@nestjs/common';
import { GateService } from './gate.service';
import { GateController } from './gate.controller';
import { HeadcountModule } from '../../gateways/headcount.module';

@Module({
  imports: [HeadcountModule],
  providers: [GateService],
  controllers: [GateController],
  exports: [GateService],
})
export class GateModule {}

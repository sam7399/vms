import { Module } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { VisitorsController } from './visitors.controller';
import { HeadcountModule } from '../../gateways/headcount.module';

@Module({
  imports: [HeadcountModule],
  providers: [VisitorsService],
  controllers: [VisitorsController],
  exports: [VisitorsService],
})
export class VisitorsModule {}

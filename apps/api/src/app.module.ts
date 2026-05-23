import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { GateModule } from './modules/gate/gate.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { AdminModule } from './modules/admin/admin.module';
import { HeadcountModule } from './gateways/headcount.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    HeadcountModule,
    AuthModule,
    VisitorsModule,
    GateModule,
    ComplianceModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

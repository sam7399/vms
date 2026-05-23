import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { GateModule } from './modules/gate/gate.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { HeadcountGateway } from './gateways/headcount.gateway';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    AuthModule,
    VisitorsModule,
    GateModule,
    ComplianceModule,
  ],
  controllers: [HealthController],
  providers: [HeadcountGateway],
})
export class AppModule {}

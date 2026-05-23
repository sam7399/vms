import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { GateModule } from './modules/gate/gate.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { AdminModule } from './modules/admin/admin.module';
import { PublicModule } from './modules/public/public.module';
import { HeadcountModule } from './gateways/headcount.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },   // 10 req/sec burst
      { name: 'medium', ttl: 60_000, limit: 120 }, // 120 req/min sustained
    ]),
    HeadcountModule,
    AuthModule,
    VisitorsModule,
    GateModule,
    ComplianceModule,
    AdminModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

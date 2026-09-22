import { Controller, Get, Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module'; 
import { PrismaService } from './prisma/prisma.service'; 
import { AuthModule } from './auth/auth.module'; 
import { UsersModule } from './users/users.module'; 
import { BarbersModule } from './barbers/barbers.module'; 
import { SeatsModule } from './seats/seats.module'; 
import { ServicesModule } from './services/services.module'; 
import { InventoryModule } from './inventory/inventory.module'; 
import { CheckoutsModule } from './checkouts/checkouts.module'; 
import { ReportsModule } from './reports/reports.module'; 
import { AuditModule } from './audit/audit.module';
import { ConfigModule } from '@nestjs/config';

@Controller() class HealthController { constructor(private prisma:PrismaService){} @Get('health') async health(){ await this.prisma.$queryRaw`SELECT 1`; return {status:'ok',database:'connected'}; } }
@Module({imports:[ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }), PrismaModule,AuthModule,UsersModule,BarbersModule,SeatsModule,ServicesModule,InventoryModule,CheckoutsModule,ReportsModule,AuditModule],controllers:[HealthController]}) export class AppModule {}

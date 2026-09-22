import { Module } from '@nestjs/common'; import { AuthModule } from '../auth/auth.module'; import { ServicesController } from './services.controller';
@Module({imports:[AuthModule],controllers:[ServicesController]}) export class ServicesModule {}

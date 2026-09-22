import { Module } from '@nestjs/common'; import { AuthModule } from '../auth/auth.module'; import { SeatsController } from './seats.controller';
@Module({imports:[AuthModule],controllers:[SeatsController]}) export class SeatsModule {}

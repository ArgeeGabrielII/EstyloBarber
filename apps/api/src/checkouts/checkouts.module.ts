import { Module } from '@nestjs/common'; import { AuthModule } from '../auth/auth.module'; import { CheckoutsController } from './checkouts.controller'; import { CheckoutsService } from './checkouts.service';
@Module({imports:[AuthModule],controllers:[CheckoutsController],providers:[CheckoutsService]}) export class CheckoutsModule {}

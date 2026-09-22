import { Module } from '@nestjs/common'; import { AuthModule } from '../auth/auth.module'; import { InventoryController } from './inventory.controller';
@Module({imports:[AuthModule],controllers:[InventoryController]}) export class InventoryModule {}

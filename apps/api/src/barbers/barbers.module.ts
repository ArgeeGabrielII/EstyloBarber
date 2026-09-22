import { Module } from '@nestjs/common'; import { AuthModule } from '../auth/auth.module'; import { BarbersController } from './barbers.controller';
@Module({ imports:[AuthModule], controllers:[BarbersController] }) export class BarbersModule {}

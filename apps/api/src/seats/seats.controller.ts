import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard'; import { RolesGuard } from '../auth/roles.guard'; import { Roles } from '../common/roles.decorator'; import { PrismaService } from '../prisma/prisma.service';
@Controller('seats') @UseGuards(AuthGuard, RolesGuard) export class SeatsController {
  constructor(private prisma: PrismaService) {}
  @Get() @Roles(UserRole.ADMIN, UserRole.CASHIER) list(){ return this.prisma.seat.findMany({ where:{active:true}, orderBy:{number:'asc'} }); }
}

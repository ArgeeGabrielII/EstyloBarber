import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard'; import { RolesGuard } from '../auth/roles.guard'; import { AuthUser, CurrentUser } from '../common/current-user.decorator'; import { Roles } from '../common/roles.decorator';
import { CreateCheckoutDto, VoidTransactionDto } from './checkouts.dto'; import { CheckoutsService } from './checkouts.service';
@Controller() @UseGuards(AuthGuard,RolesGuard)
export class CheckoutsController {
 constructor(private service:CheckoutsService){}
 @Post('checkouts') @Roles(UserRole.ADMIN,UserRole.CASHIER) create(@Body()dto:CreateCheckoutDto,@CurrentUser()user:AuthUser){return this.service.create(dto,user.id)}
 @Get('transactions') @Roles(UserRole.ADMIN) list(){return this.service.list()}
 @Get('transactions/:id') @Roles(UserRole.ADMIN,UserRole.CASHIER) get(@Param('id')id:string){return this.service.get(id)}
 @Post('transactions/:id/void') @Roles(UserRole.ADMIN) void(@Param('id')id:string,@Body()dto:VoidTransactionDto,@CurrentUser()user:AuthUser){return this.service.void(id,dto.reason,user.id)}
}

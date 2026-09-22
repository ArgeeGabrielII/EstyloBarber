import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private prisma: PrismaService) {}
  @Get() list() { return this.prisma.user.findMany({ select: { id: true, username: true, displayName: true, role: true, active: true, createdAt: true }, orderBy: { username: 'asc' } }); }
  @Post() async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    const user = await this.prisma.user.create({ data: { username: dto.username, displayName: dto.displayName, role: dto.role, passwordHash: await argon2.hash(dto.password) }, select: { id: true, username: true, displayName: true, role: true, active: true } });
    await this.prisma.auditLog.create({ data: { event: 'USER_CREATED', entityType: 'User', entityId: user.id, userId: actor.id, newValue: user } });
    return user;
  }
  @Patch(':id') async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    const old = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (old.role === UserRole.ADMIN && dto.active === false) {
      const adminCount = await this.prisma.user.count({ where: { role: UserRole.ADMIN, active: true } });
      if (adminCount <= 1) throw new BadRequestException('Cannot disable the only active administrator');
    }
    const data: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password) data.passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.update({ where: { id }, data, select: { id: true, username: true, displayName: true, role: true, active: true } });
    await this.prisma.auditLog.create({ data: { event: 'USER_UPDATED', entityType: 'User', entityId: id, userId: actor.id, oldValue: { displayName: old.displayName, role: old.role, active: old.active }, newValue: user } });
    return user;
  }
}

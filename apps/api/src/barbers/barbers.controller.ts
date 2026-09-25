import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

class CreateBarberDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsInt()
  @Min(0)
  displayOrder!: number;
}

class UpdateBarberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@Controller('barbers')
@UseGuards(AuthGuard, RolesGuard)
export class BarbersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  list() {
    return this.prisma.barber.findMany({
      where: {
        active: true,
      },
      orderBy: [
        {
          displayOrder: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  /*
   * Cashier may read all barbers so historical transactions
   * can still be filtered by a barber who is now inactive.
   * This endpoint remains read-only for Cashier.
   */
  @Get('all')
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  all() {
    return this.prisma.barber.findMany({
      orderBy: [
        {
          displayOrder: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateBarberDto) {
    const code = dto.code.trim().toUpperCase();

    try {
      return await this.prisma.barber.create({
        data: {
          ...dto,
          code,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Barber code "${code}" already exists.`);
      }

      throw error;
    }
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateBarberDto) {
    return this.prisma.barber.update({
      where: {
        id,
      },
      data: dto,
    });
  }
}

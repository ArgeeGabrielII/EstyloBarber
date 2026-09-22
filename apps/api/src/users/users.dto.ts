import { UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
export class CreateUserDto {
  @IsString() username!: string;
  @IsString() displayName!: string;
  @IsEnum(UserRole) role!: UserRole;
  @IsString() @MinLength(8) password!: string;
}
export class UpdateUserDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

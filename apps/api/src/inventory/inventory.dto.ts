import { InventoryType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
export class CreateInventoryItemDto {
  @IsString() sku!: string; @IsString() name!: string; @IsOptional() @IsString() description?: string;
  @IsEnum(InventoryType) type!: InventoryType; @IsString() unit!: string;
  @IsNumberString() quantityOnHand!: string; @IsNumberString() warningLevel!: string; @IsNumberString() reorderLevel!: string;
  @IsOptional() @IsNumberString() cost?: string; @IsOptional() @IsNumberString() sellingPrice?: string;
}
export class UpdateInventoryItemDto {
  @IsOptional() @IsString() name?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsEnum(InventoryType) type?: InventoryType;
  @IsOptional() @IsString() unit?: string; @IsOptional() @IsNumberString() warningLevel?: string; @IsOptional() @IsNumberString() reorderLevel?: string;
  @IsOptional() @IsNumberString() cost?: string; @IsOptional() @IsNumberString() sellingPrice?: string; @IsOptional() @IsBoolean() active?: boolean;
}
export class InventoryQuantityDto { @IsNumberString() quantity!: string; @IsString() reason!: string; }

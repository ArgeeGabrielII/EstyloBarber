import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
class ServiceSelectionDto { @IsUUID() serviceId!: string; @IsInt() @Min(1) quantity!: number; }
class ItemSelectionDto { @IsUUID() inventoryItemId!: string; @IsNumberString() quantity!: string; }
export class CreateCheckoutDto {
  @IsUUID() idempotencyKey!: string;
  @IsOptional() @IsUUID() barberId?: string;
  @IsOptional() @IsUUID() seatId?: string;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>ServiceSelectionDto) services!: ServiceSelectionDto[];
  @IsArray() @ArrayMaxSize(30) @ValidateNested({each:true}) @Type(()=>ItemSelectionDto) items!: ItemSelectionDto[];
  @IsNumberString() tip!: string;
}
export class VoidTransactionDto { @IsString() reason!: string; }

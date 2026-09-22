import { IsBoolean, IsInt, IsNumberString, IsOptional, IsString, Min } from 'class-validator';
export class CreateServiceDto {
  @IsString() code!: string; @IsString() name!: string; @IsOptional() @IsString() description?: string;
  @IsNumberString() fee!: string; @IsOptional() @IsInt() @Min(1) durationMinutes?: number; @IsInt() @Min(0) displayOrder!: number;
}
export class UpdateServiceDto {
  @IsOptional() @IsString() name?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsNumberString() fee?: string;
  @IsOptional() @IsInt() @Min(1) durationMinutes?: number; @IsOptional() @IsInt() @Min(0) displayOrder?: number; @IsOptional() @IsBoolean() active?: boolean;
}

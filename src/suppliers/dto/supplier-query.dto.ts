import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsBoolean,
} from 'class-validator'; // 👈 ضفنا IsBoolean
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class SupplierQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'SUP-',
    description: 'Search by name, code, or phone',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  // 🛑 ─── إضافة خاصية تضمين الموردين غير النشطين (الأرشيف) ───
  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Set to true to include soft-deleted suppliers',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true) // تحويل القيمة النصية القادمة من الرابط إلى Boolean
  @IsBoolean()
  includeInactive?: boolean;
}

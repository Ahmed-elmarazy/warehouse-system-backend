import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProductQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (default: 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Items per page (default: 10)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'cola',
    description: 'Search by product name or code (SKU)',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    example: '664f1b2c9e1a4b001c8d1234',
    description: 'Filter by category',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  // 🚀 [إضافة حقل التحكم في المنتجات المؤرشفة وغير النشطة]
  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Include inactive/soft-deleted products in the results',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  includeInactive?: boolean = false; // الوضع الافتراضي يعرض النشط فقط لحماية دورة المبيعات
}

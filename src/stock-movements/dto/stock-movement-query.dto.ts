import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class StockMovementQueryDto {
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

  @ApiPropertyOptional({ example: '664f1b2c9e1a4b001c8d9999' })
  @IsOptional()
  @IsMongoId()
  productId?: string;

  @ApiPropertyOptional({
    example: 'SALE',
    enum: [
      'PURCHASE',
      'SALE',
      'CUSTOMER_RETURN',
      'SUPPLIER_RETURN',
      'ADJUSTMENT',
    ],
  })
  @IsOptional()
  @IsEnum([
    'PURCHASE',
    'SALE',
    'CUSTOMER_RETURN',
    'SUPPLIER_RETURN',
    'ADJUSTMENT',
  ])
  type?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Start date format (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'End date format (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}

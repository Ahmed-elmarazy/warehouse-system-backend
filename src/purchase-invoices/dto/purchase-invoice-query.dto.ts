import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PurchaseInvoiceQueryDto {
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
    example: 'INV-PUR-',
    description: 'Search by invoice number',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'SUPP-99182' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Filter start date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Filter end date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}

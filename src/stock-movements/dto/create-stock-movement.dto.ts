import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateStockMovementDto {
  @ApiProperty({
    example: '664f1b2c9e1a4b001c8d9999',
    description: 'Product MongoDB ObjectId',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    example: 'SALE',
    enum: [
      'PURCHASE',
      'SALE',
      'CUSTOMER_RETURN',
      'SUPPLIER_RETURN',
      'ADJUSTMENT',
    ],
  })
  @IsEnum([
    'PURCHASE',
    'SALE',
    'CUSTOMER_RETURN',
    'SUPPLIER_RETURN',
    'ADJUSTMENT',
  ])
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    example: 'SALES_INVOICE',
    enum: ['PURCHASE_INVOICE', 'SALES_INVOICE', 'RETURN', 'MANUAL'],
  })
  @IsEnum(['PURCHASE_INVOICE', 'SALES_INVOICE', 'RETURN', 'MANUAL'])
  @IsNotEmpty()
  referenceType: string;

  @ApiPropertyOptional({
    example: 'INV-2026-001',
    description: 'ID of the source document',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  referenceId?: string;

  @ApiProperty({
    example: 12,
    description:
      'Quantity changed in PIECES (Always positive here, business logic handles direction)',
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  quantityChanged: number;

  @ApiPropertyOptional({ example: 'Stock deduction for bulk order' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() ?? null)
  notes?: string;
}

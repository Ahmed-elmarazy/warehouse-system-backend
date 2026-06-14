import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Coca Cola 330ml' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'SKU-CC-330' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim().toUpperCase())
  code: string;

  @ApiProperty({ example: '664f1b2c9e1a4b001c8d1234' })
  @IsMongoId()
  @IsNotEmpty()
  categoryId: string;



  // ── Pricing ───────────────────────────────────────────────────────────────

  @ApiProperty({ example: 50.0, description: 'Purchase price per carton' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @ApiProperty({ example: 75.0, description: 'Selling price per carton' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cartonPrice: number;

  @ApiProperty({ example: 7.5, description: 'Selling price per piece' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  piecePrice: number;

  // ── Stock ─────────────────────────────────────────────────────────────────

  @ApiProperty({ example: 12, description: 'Number of pieces in one carton' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  piecesPerCarton: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Initial stock in pieces (defaults to 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityInPieces?: number;

  @ApiProperty({ example: 24, description: 'Alert threshold — low stock' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumQuantity: number;

  @ApiProperty({ example: 500, description: 'Alert threshold — overstock' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maximumQuantity: number;

  // ── Meta ──────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'Stored in refrigerated section' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim() ?? null)
  notes?: string;
}

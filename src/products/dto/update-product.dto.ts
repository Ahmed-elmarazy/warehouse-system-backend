import {
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Coca Cola 500ml' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ example: 'SKU-CC-500' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim().toUpperCase())
  code?: string;

  @ApiPropertyOptional({ example: '664f1b2c9e1a4b001c8d1234' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  

  // ── Pricing ───────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 55.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ example: 80.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cartonPrice?: number;

  @ApiPropertyOptional({ example: 8.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  piecePrice?: number;

  // ── Stock ─────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  piecesPerCarton?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumQuantity?: number;

  @ApiPropertyOptional({ example: 600 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maximumQuantity?: number;

  // ── Meta ──────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'Updated storage note' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim() ?? null)
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

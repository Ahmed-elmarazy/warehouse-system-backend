import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePurchaseItemDto {
  @ApiProperty({
    example: '6a26d149f8034cc78d7befb2',
    description: 'Product MongoDB ObjectId',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 2, description: 'Number of cartons purchased' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cartons: number;

  @ApiProperty({ example: 2, description: 'Additional loose pieces purchased' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pieces: number;

  @ApiPropertyOptional({
    example: 100.0,
    description:
      'Optional purchase price per carton. If empty, falls back to Product master data.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cartonPrice?: number;

  @ApiPropertyOptional({
    example: 10.0,
    description:
      'Optional purchase price per piece. If empty, falls back to Product master data.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  piecePrice?: number;
}

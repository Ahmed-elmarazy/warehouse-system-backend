import { IsEnum, IsMongoId, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UnitType } from '../schemas/sales-invoice.schema';

export class CreateSalesItemDto {
  @ApiProperty({
    example: '6a26d149f8034cc78d7befb2',
    description: 'Product MongoDB ObjectId',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 12, description: 'Quantity required in PIECES' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'PIECE', enum: UnitType })
  @IsEnum(UnitType)
  @IsNotEmpty()
  unitType: UnitType;

  @ApiProperty({
    example: 15.5,
    description:
      'Selling price per piece. If empty, falls back to product master data.',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 0, description: 'Line item discount amount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount: number = 0;
}

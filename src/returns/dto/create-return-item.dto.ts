import { IsMongoId, IsNotEmpty, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UnitType } from '../../sales-invoices/schemas/sales-invoice.schema';

export class CreateReturnItemDto {
  [x: string]: any;
  @ApiProperty({ example: '6a26d149f8034cc78d7befb2' })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 5, description: 'Quantity in PIECES' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'PIECE', enum: UnitType })
  @IsEnum(UnitType)
  @IsNotEmpty()
  unitType: UnitType;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

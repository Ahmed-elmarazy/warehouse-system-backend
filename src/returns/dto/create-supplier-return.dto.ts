import {
  IsMongoId,
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class SupplierItemDto {
  @ApiProperty({ example: '6a26d149f8034cc78d7befb2' })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 15 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateSupplierReturnDto {
  @ApiProperty({ example: '6d26d149f8034cc78d7beee4' })
  @IsMongoId()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({ type: [SupplierItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierItemDto)
  items: SupplierItemDto[];

  @ApiProperty({ example: 'expired goods returned to supplier' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

import {
  IsMongoId,
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UnitType } from '../../sales-invoices/schemas/sales-invoice.schema';

class SupplierItemDto {
  @ApiProperty({
    example: '6a26d149f8034cc78d7befb2',
    description: 'ID المنتج',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 1, description: 'الكمية المرجعة للمورد' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 'CARTON',
    enum: UnitType,
    description: 'الوحدة المرجعة للمورد (كرتونة أو قطعة)',
  })
  @IsEnum(UnitType)
  @IsNotEmpty()
  unitType: UnitType;

  @ApiProperty({ example: 100, description: 'سعر التكلفة المرتجع بها للمورد' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateSupplierReturnDto {
  @ApiProperty({
    example: '6e26d149f8034cc78d7bffee',
    description: 'ID المورد',
  })
  @IsMongoId()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({
    type: [SupplierItemDto],
    description: 'الأصناف المرجعة للمورد',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierItemDto)
  items: SupplierItemDto[];

  @ApiProperty({ example: 'مرتجع بضاعة قاربت على انتهاء الصلاحية للمورد' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

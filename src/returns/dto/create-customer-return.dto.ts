import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UnitType } from '../../sales-invoices/schemas/sales-invoice.schema';

class ReturnItemDto {
  @ApiProperty({
    example: '6a26d149f8034cc78d7befb2',
    description: 'ID المنتج',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 2, description: 'الكمية المرتجعة (حسب نوع الوحدة)' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 'CARTON',
    enum: UnitType,
    description: 'نوع الوحدة المرتجعة',
  })
  @IsEnum(UnitType)
  @IsNotEmpty()
  unitType: UnitType;

  @ApiProperty({ example: 120, description: 'سعر الوحدة المسترد للعميل' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 90,
    required: false,
    description: 'سعر الشراء (اختياري للتقارير)',
  })
  @IsNumber()
  @IsOptional()
  purchasePrice?: number;
}

export class CreateCustomerReturnDto {
  @ApiProperty({
    example: '6d26d149f8034cc78d7beee4',
    description: 'ID العميل',
  })
  @IsMongoId()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    example: '6e26d149f8034cc78d7bfff1',
    required: false,
    description: 'ID الفاتورة المرتبطة إن وجدت',
  })
  @IsMongoId()
  @IsOptional()
  invoiceId?: string;

  @ApiProperty({ type: [ReturnItemDto], description: 'قائمة الأصناف المرتجعة' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @ApiProperty({
    example: 'CREDIT',
    enum: ['CASH', 'CREDIT'],
    description: 'طريقة رد المبلغ (نقدي أم حساب مديونية)',
  })
  @IsEnum(['CASH', 'CREDIT'])
  @IsNotEmpty()
  returnType: 'CASH' | 'CREDIT';

  @ApiProperty({
    example: 'بضاعة بها عيب تصنيع',
    required: false,
    description: 'سبب الارتجاع',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

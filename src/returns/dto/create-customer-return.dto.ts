// 📄 src/returns/dto/create-customer-return.dto.ts
// ⚠️  تحديث مطلوب: إضافة حقل returnType للـ DTO

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

class ReturnItemDto {
  @IsMongoId()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  unitType: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  purchasePrice?: number;
}

export class CreateCustomerReturnDto {
  @IsMongoId()
  customerId: string;

  @IsMongoId()
  @IsOptional()
  invoiceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  /**
   * نوع المرتجع:
   * CASH   → العميل هياخد فلوسه كاش (يخرج من الخزنة)
   * CREDIT → يتخصم من مديونيته (الكاش ما يتأثرش)
   */
  @IsEnum(['CASH', 'CREDIT'])
  @IsNotEmpty()
  returnType: 'CASH' | 'CREDIT';

  @IsString()
  @IsOptional()
  reason?: string;
}

// 📄 src/search/dto/search-query.dto.ts

import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'; // 👈 مهم جداً لـ Swagger UI

export enum SearchEntityType {
  PRODUCTS = 'products',
  CUSTOMERS = 'customers',
  SUPPLIERS = 'suppliers',
  SALES_INVOICES = 'salesInvoices',
  PURCHASE_INVOICES = 'purchaseInvoices',
  PAYMENTS = 'payments',
}

export class SearchQueryDto {
  @ApiProperty({
    description: 'نص البحث (اسم، كود، رقم هاتف، رقم فاتورة)',
    example: 'coca',
  })
  @IsString()
  @IsNotEmpty()
  q: string;

  @ApiPropertyOptional({
    description: 'فلترة البحث بكيان معين فقط',
    enum: SearchEntityType,
  })
  @IsOptional()
  @IsEnum(SearchEntityType)
  type?: SearchEntityType;

  @ApiPropertyOptional({ description: 'رقم الصفحة', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر لكل جدول', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

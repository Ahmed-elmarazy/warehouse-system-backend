// 📄 src/customers/dto/create-customer.dto.ts

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateCustomerDto {
  @ApiProperty({
    example: 'مجموعة أولاد رجب للتجارة',
    description: 'Customer or company name',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: '01098765432' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  phone: string;

  @ApiPropertyOptional({ example: 'info@customer.com' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;

  @ApiPropertyOptional({ example: 'شارع الجلاء، شبين الكوم، المنوفية' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  address?: string;

  @ApiPropertyOptional({
    example: 1500,
    description: 'المديونية السابقة المستحقة على العميل قبل استخدام السيستم',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value !== undefined ? Number(value) : 0))
  openingBalance?: number; // 👈 الحقل الجديد

  @ApiPropertyOptional({ example: 'عميل جملة - التعامل بنظام الدفع الجزئي' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim() ?? null)
  notes?: string;
}

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateSupplierDto {
  @ApiProperty({
    example: 'الشركة المصرية للتوريدات',
    description: 'Supplier company or vendor name',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  phone: string;

  @ApiPropertyOptional({ example: 'vendor@supplier.com' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;

  @ApiPropertyOptional({ example: 'المنطقة الصناعية، قويسنا، المنوفية' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  address?: string;

  @ApiPropertyOptional({ example: 'مورد رئيسي لمنتجات المشروبات الغازية' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim() ?? null)
  notes?: string;
}

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkerDto {
  @ApiProperty({
    description: 'اسم العامل بالكامل',
    example: 'محمد علي حسن',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'رقم هاتف العامل للاتصال به',
    example: '01012345678',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'العنوان الحالي لإقامة العامل',
    example: 'شبين الكوم، المنوفية',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({
    description: 'الرقم القومي المكون من 14 رقم (اختياري)',
    example: '29501011701234',
    required: false,
  })
  @IsString()
  @IsOptional()
  nationalId?: string;
}

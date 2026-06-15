import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddPaymentDto {
  @ApiProperty({
    description: 'المبلغ المالي المدفوع للعامل بالجنيه',
    example: 1500,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'دورية أو نوع الفترة المخصصة للصرف',
    enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'OTHER'],
    example: 'WEEKLY',
  })
  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY', 'OTHER'])
  @IsNotEmpty()
  periodType: string;

  @ApiPropertyOptional({
    description: 'أي ملاحظات إضافية تخص هذه الدفعة',
    example: 'صرفية الأسبوع الأول من شهر يونيو لبناء السور الجديد',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

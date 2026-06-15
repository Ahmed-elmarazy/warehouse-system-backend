import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContainerDto {
  @ApiProperty({
    description: 'رقم الحاوية الفريد أو الكود الخاص بها',
    example: 'CNTR-2026-XYZ',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  containerNumber: string;

  // 🔥 الحقل الجديد الأول: مكان منشأ أو جهة وصول الحاوية
  @ApiProperty({
    description: 'مكان وصول أو منشأ الحاوية (اسم المورد أو بلد الشحن)',
    example: 'الصين - شركة النور',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  origin: string;

  // 🔥 الحقل الجديد الثاني: محتويات الحاوية بشكل نصي حر
  @ApiProperty({
    description: 'تفاصيل ومحتويات البضاعة داخل الحاوية',
    example: 'كابلات كهرباء، كشافات ليد، ومحولات',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  contentDetails: string;

  @ApiProperty({
    description: 'السعر الإجمالي للحاوية من المورد',
    example: 120000,
    minimum: 0,
    type: Number,
  })
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @ApiPropertyOptional({
    description: 'المبلغ الذي تم دفعه مقدماً للحاوية',
    example: 50000,
    default: 0,
    minimum: 0,
    type: Number,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  paidAmount?: number;

  @ApiPropertyOptional({
    description: 'تاريخ وصول أو جلب الحاوية',
    example: '2026-06-15',
    type: String,
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  arrivalDate?: string;

  @ApiPropertyOptional({
    description: 'ملاحظات أو تذكيرات خاصة بالحاوية وصاحب العمل',
    example: 'باقي الحساب سيتم تسويته عند الاستلام الفعلي بالميناء',
    type: String,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

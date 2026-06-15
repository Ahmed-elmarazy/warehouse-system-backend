import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentDto {
  @ApiPropertyOptional({
    example: 'تحديث الملاحظات: تم التأكد من التحويل البنكي',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupplierPaymentDto {
  @ApiProperty({ example: 1500, description: 'المبلغ المدفوع للمورد' })
  @IsNumber()
  @IsPositive()
  readonly amount: number;

  @ApiProperty({
    example: 'دفعة حساب نقدي',
    description: 'ملاحظات الدفعة',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly notes?: string;
}

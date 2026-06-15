import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../schemas/payment.schema';

export class CreatePaymentDto {
  @ApiProperty({
    example: '6b26d149f8034cc78d7becc1',
    description: 'Customer MongoDB ObjectId',
  })
  @IsMongoId()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: 500.5, description: 'Amount paid by the customer' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'CASH', enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    example: ['6c26d149f8034cc78d7bedd2'],
    description: 'Optional list of related Sales Invoice IDs',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  relatedInvoices?: string[];

  @ApiPropertyOptional({
    example: 'دفعة تحت الحساب - استلام كاش في الخزنة الرئيسية',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

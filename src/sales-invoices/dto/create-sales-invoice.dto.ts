import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateSalesItemDto } from './create-sales-item.dto';
import { PaymentType } from '../schemas/sales-invoice.schema';

export class CreateSalesInvoiceDto {
  @ApiProperty({
    example: '6b26d149f8034cc78d7becc1',
    description: 'Customer MongoDB ObjectId',
  })
  @IsMongoId()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ type: [CreateSalesItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesItemDto)
  items: CreateSalesItemDto[];

  @ApiProperty({ example: 10, description: 'Main invoice discount amount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount: number = 0;

  @ApiProperty({
    example: 100,
    description: 'Amount collected cash from customer',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount: number;

  @ApiProperty({ example: 'PARTIAL', enum: PaymentType })
  @IsEnum(PaymentType)
  @IsNotEmpty()
  paymentType: PaymentType;
}

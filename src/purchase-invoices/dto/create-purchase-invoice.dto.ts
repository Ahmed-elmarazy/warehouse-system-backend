import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreatePurchaseItemDto } from './create-purchase-item.dto';

export class CreatePurchaseInvoiceDto {
  @ApiProperty({
    example: 'SUPP-99182',
    description: 'Supplier reference identifier',
  })
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({
    type: [CreatePurchaseItemDto],
    description: 'List of items included in this invoice',
  })
  @IsArray()
  // ✅ التعديل هنا: مسحنا الجملة اللي مسببة الـ Error وسيبنا الـ الخصائص المعرفة فقط
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];
}

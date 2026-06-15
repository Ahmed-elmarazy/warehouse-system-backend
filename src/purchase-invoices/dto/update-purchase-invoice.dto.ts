import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreatePurchaseItemDto } from './create-purchase-item.dto';

export class UpdatePurchaseInvoiceDto {
  @ApiPropertyOptional({
    example: 'SUPP-99182',
    description: 'Update the supplier identifier if needed',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({
    type: [CreatePurchaseItemDto],
    description:
      'Provide the full updated list of items. Note: This will override the existing items array.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items?: CreatePurchaseItemDto[];
}

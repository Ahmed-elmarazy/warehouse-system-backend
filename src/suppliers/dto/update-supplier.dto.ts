import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @ApiPropertyOptional({
    example: true,
    description: 'Reactivate or deactivate supplier',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // 👈 فك الحظر عن الحقل هنا ليقبل التعديل
}

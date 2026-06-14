import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CategoryQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'Electronics' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  // الحقول القديمة للـ Pagination (مثل page و limit) سيبها زي ما هي هنا...
  @ApiPropertyOptional({
    example: true,
    description: 'Include inactive categories in the results',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true) // تحويل النص الآتي من الـ URL إلى Boolean
  @IsBoolean()
  includeInactive?: boolean;
}

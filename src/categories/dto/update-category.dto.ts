import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Electronics & Gadgets' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim() ?? null)
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Ahmed Ali' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'ahmed.ali@warehouse.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email' })
  email?: string;

  @ApiPropertyOptional({ example: '01111111111' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,15}$/, { message: 'Invalid phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // role is intentionally excluded — cannot be changed via API
}

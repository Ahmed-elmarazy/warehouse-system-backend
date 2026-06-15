import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Ahmed Mohamed' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'ahmed@warehouse.com' })
  @IsEmail({}, { message: 'Please provide a valid email' })
  email: string;

  @ApiProperty({ example: 'Pass@1234', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @ApiPropertyOptional({ example: '01000000000' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,15}$/, { message: 'Invalid phone number' })
  phone?: string;
}

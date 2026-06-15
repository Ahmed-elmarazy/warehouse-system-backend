import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'owner@warehouse.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}

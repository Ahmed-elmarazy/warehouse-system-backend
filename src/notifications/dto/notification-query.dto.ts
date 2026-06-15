import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationQueryDto {
  @IsOptional()
  @IsEnum(['INVENTORY', 'FINANCIAL', 'SYSTEM', 'ACTIVITY'])
  type?: string;

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH'])
  severity?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

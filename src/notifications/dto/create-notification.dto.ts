import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsMongoId,
} from 'class-validator';

export class CreateNotificationDto {
  @IsEnum(['INVENTORY', 'FINANCIAL', 'SYSTEM', 'ACTIVITY'])
  type: string;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsString()
  entityType: string;

  @IsOptional()
  @IsMongoId()
  entityId?: string;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH'])
  severity: string;

  @IsOptional()
  @IsMongoId()
  createdBy?: string;
}

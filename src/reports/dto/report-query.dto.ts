// 📄 src/reports/dto/report-query.dto.ts

import { IsOptional, IsString, IsDateString } from 'class-validator';

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string; // تاريخ بدء التقرير (مثال: 2026-01-01)

  @IsOptional()
  @IsDateString()
  to?: string; // تاريخ نهاية التقرير (مثال: 2026-01-31)
}

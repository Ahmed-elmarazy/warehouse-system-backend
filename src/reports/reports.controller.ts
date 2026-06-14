// 📄 src/reports/reports.controller.ts

import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@Controller('reports')
@ApiBearerAuth('access-token') // 👈 ضيف ده فوراً عشان الـ Swagger يبعت الـ Token
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RolesGuard) // تأكد من أن المستخدم مسجل دخول وصلاحياته مناسبة
  @Roles(Role.OWNER) // قفل الـ Endpoint لصلاحية المالك فقط لحماية الحسابات المالية
  async getDashboard(@Query() queryDto: ReportQueryDto) {
    const analytics = await this.reportsService.getDashboardAnalytics(queryDto);

    return {
      success: true,
      message: 'Dashboard analytics retrieved successfully',
      data: analytics,
    };
  }
}

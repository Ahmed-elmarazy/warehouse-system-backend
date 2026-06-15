// 📄 src/notifications/notifications.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard) // تأمين الوصول للمسجلين بالسيستم فقط
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}


  @Get()
  @ApiOperation({
    summary: 'جلب الإشعارات مقسمة ومفلترة حسب الصلاحيات والـ Role',
  })
  async findAll(@Query() query: NotificationQueryDto, @Request() req: any) {
    const data = await this.notificationsService.findAll(query, req.user);
    return {
      success: true,
      message: 'Notifications retrieved successfully',
      data,
    };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'تحديد تنبيه معين كمقروء' })
  async markAsRead(@Param('id') id: string) {
    await this.notificationsService.markAsRead(id);
    return {
      success: true,
      message: 'Notification marked as read',
      data: null,
    };
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'تحديد كل تنبيهات الـ Scope الحالي كمقروءة دفعة واحدة',
  })
  async markAllAsRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user);
    return {
      success: true,
      message: 'All notifications marked as read',
      data: null,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف إشعار نهائياً من النظام' })
  async delete(@Param('id') id: string) {
    await this.notificationsService.delete(id);
    return {
      success: true,
      message: 'Notification deleted successfully',
      data: null,
    };
  }
}

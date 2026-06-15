// 📄 src/notifications/notifications.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter'; // 👈 استيراد الـ Events handler
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './gateways/notifications.gateway';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    EventEmitterModule.forRoot(), // تفعيل الإشعارات الحدثية على مستوى الـ Container لو مش مفعل في الـ App الرئيسي
    AuthModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService], // للسماح بالحقن المباشر في الحالات الخاصة
})
export class NotificationsModule {}

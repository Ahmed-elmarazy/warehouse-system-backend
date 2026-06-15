// 📄 src/notifications/schemas/notification.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({
    type: String,
    required: true,
    enum: ['INVENTORY', 'FINANCIAL', 'SYSTEM', 'ACTIVITY'],
    index: true,
  })
  type: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: String, required: true })
  entityType: string; // مثال: Product, Customer, Invoice

  @Prop({ type: String, required: false }) // 👈 خليه String عشان يقبل أي ID من أي كوليكشن بسهولة
  entityId?: string;

  @Prop({
    type: String,
    required: true,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'LOW',
  })
  severity: string;

  @Prop({ type: Boolean, default: false, index: true })
  isRead: boolean;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Employee',
    required: false,
  })
  createdBy?: string;

  @Prop({ type: Date, default: Date.now, index: true }) // Index لسرعة الترتيب والـ Pagination
  createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

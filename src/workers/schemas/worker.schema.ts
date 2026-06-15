import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Worker extends Document {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: false, trim: true, default: null }) // اختياري
  nationalId: string;

  @Prop({ type: Number, default: 0 }) // إجمالي ما تقاضاه العامل
  totalPaid: number;

  @Prop({ type: Boolean, default: true }) // لتفعيل أو أرشفة العامل
  isActive: boolean;

  @Prop({ type: Types.ObjectId, required: true }) // من المالك اللي ضافه
  createdBy: Types.ObjectId;
}

export const WorkerSchema = SchemaFactory.createForClass(Worker);
// عمل Index لتسريع البحث بالاسم والهاتف
WorkerSchema.index({ name: 'text', phone: 1 });

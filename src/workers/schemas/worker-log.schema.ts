import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class WorkerLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Worker', required: true })
  workerId: Types.ObjectId;

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({
    required: true,
    enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'OTHER'],
    default: 'OTHER',
  })
  periodType: string; // نوع الدفعة (يومي، أسبوعي، شهري)

  @Prop({ required: false, trim: true })
  notes: string; // ملاحظات (مثلاً: دفعة الأسبوع الأول من يونيو)

  @Prop({ type: Types.ObjectId, required: true })
  createdBy: Types.ObjectId;
}

export const WorkerLogSchema = SchemaFactory.createForClass(WorkerLog);

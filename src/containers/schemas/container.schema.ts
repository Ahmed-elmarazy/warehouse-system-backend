import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContainerDocument = Container & Document;

@Schema({ timestamps: true })
export class Container {
  @Prop({ required: true, unique: true, trim: true })
  containerNumber: string;

  // 1️⃣ الحقل الجديد الأول: بتكتب فيه بإيدك الحاوية جاية منين (نص حر)
  @Prop({ required: true, trim: true })
  origin: string; // مثال: "الصين - شركة النور" أو "ميناء دبي"

  // 2️⃣ الحقل الجديد الثاني: بتكتب فيه بإيدك محتويات الحاوية (نص حر)
  @Prop({ required: true, trim: true })
  contentDetails: string; // مثال: "كابلات كهرباء، كشافات ليد، ومحولات"

  @Prop({ required: true, min: 0 })
  totalPrice: number;

  @Prop({ required: true, min: 0, default: 0 })
  paidAmount: number;

  @Prop({ min: 0, default: 0 })
  remainingAmount: number;

  @Prop({ required: true, default: Date.now })
  arrivalDate: Date;

  @Prop({ trim: true })
  notes: string;
}

export const ContainerSchema = SchemaFactory.createForClass(Container);

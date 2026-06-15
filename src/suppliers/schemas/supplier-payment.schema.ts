import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SupplierPaymentDocument = SupplierPayment & Document;

@Schema({ timestamps: true })
export class SupplierPayment {
  // 🌟 إضافة الـ Types هنا عشان الـ TypeScript يفهم الـ Timestamps
  createdAt: Date;
  updatedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Supplier', required: true, index: true })
  supplierId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  createdBy: Types.ObjectId;

  @Prop({ trim: true, default: null })
  notes?: string;
}

export const SupplierPaymentSchema =
  SchemaFactory.createForClass(SupplierPayment);
SupplierPaymentSchema.index({ createdAt: -1 });

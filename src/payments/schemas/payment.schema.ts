import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
  OTHER = 'OTHER',
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true, unique: true, trim: true, index: true })
  paymentNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ required: true, min: 0.01 })
  amount: number; // المبلغ المدفوع فعلياً

  @Prop({ type: String, enum: PaymentMethod, required: true, index: true })
  paymentMethod: PaymentMethod;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'SalesInvoice' }], default: [] })
  relatedInvoices: Types.ObjectId[]; // الفواتير المرتبطة بالسداد (اختياري)

  @Prop({ trim: true, default: null })
  notes?: string;

  @Prop({ default: true, index: true })
  isActive: boolean; // لدعم الـ Soft Delete والـ Audit Trails

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  createdBy: Types.ObjectId;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ createdAt: -1 });

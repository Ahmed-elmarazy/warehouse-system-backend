// 📄 src/sales-invoices/schemas/sales-invoice.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SalesInvoiceDocument = SalesInvoice & Document;

export enum PaymentType {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  PARTIAL = 'PARTIAL',
}

export enum UnitType {
  CARTON = 'CARTON',
  PIECE = 'PIECE',
}

@Schema({ _id: false })
class SalesItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ type: String, enum: UnitType, required: true })
  unitType: UnitType;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  discount: number;

  @Prop({ required: true, min: 0 })
  total: number;

  // 🚀 الحقول الجديدة الحاسمة لمنع تصفير وتلخبطة التقارير والأرباح:
  @Prop({ required: true, type: Number, default: 0 })
  totalPieces: number; // 👈 هنا عشان يحفظ عدد القطع الفعلي بعد فك الكرتونة

  @Prop({ required: true, type: Number, default: 0 })
  totalCost: number; // 👈 هنا عشان يحفظ تكلفة البضاعة المباعة الحقيقية (COGS)
}

const SalesItemSchema = SchemaFactory.createForClass(SalesItem);

@Schema({ timestamps: true })
export class SalesInvoice {
  @Prop({ required: true, unique: true, trim: true, index: true })
  invoiceNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true, index: true })
  customerId: Types.ObjectId;

  // ربط السكيما الفرعية بالمونجوز بشكل صريح لضمان الحفظ
  @Prop({ type: [SalesItemSchema], required: true })
  items: SalesItem[];

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ required: true, default: 0, min: 0 })
  discount: number;

  @Prop({ required: true, min: 0 })
  finalAmount: number;

  @Prop({ required: true, min: 0 })
  paidAmount: number;

  @Prop({ required: true, min: 0 })
  remainingAmount: number;

  @Prop({ type: String, enum: PaymentType, required: true, index: true })
  paymentType: PaymentType;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null }) // جعلناه اختياري لتفادي مشاكل الـ Seed أو التيست بدون توكن
  createdBy: Types.ObjectId;
}

export const SalesInvoiceSchema = SchemaFactory.createForClass(SalesInvoice);
SalesInvoiceSchema.index({ createdAt: -1 });

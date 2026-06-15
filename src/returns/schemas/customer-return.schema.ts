// 📄 src/returns/schemas/customer-return.schema.ts
// ⚠️  تحديث مطلوب: إضافة حقل returnType للسكيما

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerReturnDocument = CustomerReturn & Document;

@Schema({ timestamps: true })
export class CustomerReturn {
  @Prop({ required: true, unique: true })
  returnNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SalesInvoice', default: null })
  invoiceId: Types.ObjectId | null;

  @Prop({ type: Array, required: true })
  items: {
    productId: Types.ObjectId;
    quantity: number;
    unitType: string;
    price: number;
    total: number;
    purchasePrice: number;
    totalCost: number;
  }[];

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ default: 0 })
  totalCost: number;

  @Prop({ default: 0 })
  lostProfit: number;

  /**
   * 🔑 الحقل الجديد المطلوب
   *
   * CASH   → العميل استلم فلوسه نقداً ← الكاش خرج من الخزنة
   * CREDIT → قيمة المرتجع اتخصمت من مديونيته ← الكاش ما اتلمسش
   */
  @Prop({
    type: String,
    enum: ['CASH', 'CREDIT'],
    required: true,
    default: 'CREDIT', // الافتراضي: خصم من المديونية (الأكثر شيوعاً)
  })
  returnType: 'CASH' | 'CREDIT';

  @Prop({ default: '' })
  reason: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy: Types.ObjectId;
}

export const CustomerReturnSchema =
  SchemaFactory.createForClass(CustomerReturn);

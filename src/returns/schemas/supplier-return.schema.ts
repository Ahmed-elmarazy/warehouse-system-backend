import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SupplierReturnDocument = SupplierReturn & Document;

@Schema({ _id: false })
class SupplierReturnItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number; // الكمية المدخلة (مثلاً: 2)

  @Prop({ required: true, trim: true })
  unitType: string; // الوحدة (CARTON أو PIECE)

  @Prop({ required: true, min: 1 })
  totalPieces: number; // 👈 القطع الفعلية المخزنية بعد فك الكراتين

  @Prop({ required: true, min: 0 })
  price: number; // السعر للوحدة المرجعة

  @Prop({ required: true, min: 0 })
  total: number; // إجمالي التكلفة المستردة من المورد
}
const SupplierReturnItemSchema =
  SchemaFactory.createForClass(SupplierReturnItem);

@Schema({ timestamps: true })
export class SupplierReturn {
  @Prop({ required: true, unique: true, trim: true, index: true })
  returnNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Supplier', required: true, index: true })
  supplierId: Types.ObjectId;

  @Prop({ type: [SupplierReturnItemSchema], required: true })
  items: SupplierReturnItem[];

  @Prop({ required: true, min: 0 })
  totalAmount: number; // القيمة الإجمالية المخصومة من حساب المورد المالي

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) // تعديل ليتوافق مع الـ Auth User ID الحالي
  createdBy: Types.ObjectId;
}
export const SupplierReturnSchema =
  SchemaFactory.createForClass(SupplierReturn);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SupplierReturnDocument = SupplierReturn & Document;

@Schema({ _id: false })
class SupplierReturnItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  price: number; // تكلفة الشراء المرتجع بها

  @Prop({ required: true, min: 0 })
  total: number;
}
const SupplierReturnItemSchema =
  SchemaFactory.createForClass(SupplierReturnItem);

@Schema({ timestamps: true })
export class SupplierReturn {
  @Prop({ required: true, unique: true, trim: true, index: true })
  returnNumber: string; // مثل RET-SUPP-0001

  @Prop({ type: Types.ObjectId, ref: 'Supplier', required: true, index: true })
  supplierId: Types.ObjectId;

  @Prop({ type: [SupplierReturnItemSchema], required: true })
  items: SupplierReturnItem[];

  @Prop({ required: true, min: 0 })
  totalAmount: number; // تخصم من حساب المورد المالي

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  createdBy: Types.ObjectId;
}
export const SupplierReturnSchema =
  SchemaFactory.createForClass(SupplierReturn);

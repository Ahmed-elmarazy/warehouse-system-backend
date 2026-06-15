import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PurchaseInvoiceDocument = PurchaseInvoice & Document;

@Schema({ _id: false })
class PurchaseItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  cartons: number;

  @Prop({ required: true, min: 0 })
  pieces: number;

  @Prop({ required: true, min: 0 })
  cartonPrice: number; // السعر اللي اشتريت بيه الكرتونة في الفاتورة دي

  @Prop({ required: true, min: 0 })
  piecePrice: number; // السعر اللي اشتريت بيه القطعة في الفاتورة دي

  @Prop({ required: true, min: 0 })
  totalPieces: number; // إجمالي القطع للعنصر ده (للتوثيق السريع)

  @Prop({ required: true, min: 0 })
  total: number; // (cartons * cartonPrice) + (pieces * piecePrice)
}

const PurchaseItemSchema = SchemaFactory.createForClass(PurchaseItem);

@Schema({ timestamps: true })
export class PurchaseInvoice {
  @Prop({ required: true, unique: true, trim: true, index: true })
  invoiceNumber: string;

  @Prop({ type: String, required: true, index: true })
  supplierId: string;

  @Prop({ type: [PurchaseItemSchema], required: true })
  items: PurchaseItem[];

  @Prop({ required: true, min: 0 })
  totalAmount: number; // مجموع الـ total بتاع كل الأصناف

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  createdBy: Types.ObjectId;
}

export const PurchaseInvoiceSchema =
  SchemaFactory.createForClass(PurchaseInvoice);
PurchaseInvoiceSchema.index({ createdAt: -1 });

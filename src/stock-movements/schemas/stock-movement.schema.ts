import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockMovementDocument = StockMovement & Document;

@Schema({ timestamps: true })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({
    required: true,
    enum: [
      'PURCHASE',
      'SALE',
      'CUSTOMER_RETURN',
      'SUPPLIER_RETURN',
      'ADJUSTMENT',
    ],
    index: true,
  })
  type: string;

  @Prop({
    required: true,
    enum: ['PURCHASE_INVOICE', 'SALES_INVOICE', 'RETURN', 'MANUAL'],
  })
  referenceType: string;

  @Prop({ type: String, default: null })
  referenceId?: string;

  @Prop({ required: true, min: 0 })
  quantityBefore: number;

  @Prop({ required: true })
  quantityChanged: number; // يمكن أن تكون سالبة في البيع أو موجبة في الشراء

  @Prop({ required: true, min: 0 })
  quantityAfter: number;

  @Prop({ trim: true, default: null })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  createdBy: Types.ObjectId;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);

// إندكس مركب وتنازلي للتواريخ لتسريع جلب أحدث الحركات والـ Date Range Filters
StockMovementSchema.index({ createdAt: -1 });
StockMovementSchema.index({ productId: 1, type: 1, createdAt: -1 });

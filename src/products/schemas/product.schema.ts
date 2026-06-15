import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId: Types.ObjectId;

  

  // ── Pricing ───────────────────────────────────────────────────────────────
  @Prop({ required: true, min: 0 })
  purchasePrice: number;

  @Prop({ required: true, min: 0 })
  cartonPrice: number;

  @Prop({ required: true, min: 0 })
  piecePrice: number;

  // ── Stock ─────────────────────────────────────────────────────────────────
  @Prop({ required: true, min: 1 })
  piecesPerCarton: number;

  @Prop({ default: 0, min: 0 })
  quantityInPieces: number;

  @Prop({ required: true, min: 0 })
  minimumQuantity: number;

  @Prop({ required: true, min: 0 })
  maximumQuantity: number;

  // ── Meta ──────────────────────────────────────────────────────────────────
  @Prop({ trim: true, default: null })
  notes?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null })
  updatedBy?: Types.ObjectId;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Case-insensitive text index for search by name or code
ProductSchema.index({ name: 'text', code: 'text' });

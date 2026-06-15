import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SupplierDocument = Supplier & Document;

@Schema({ timestamps: true })
export class Supplier {
  @Prop({ required: true, unique: true, trim: true, index: true })
  supplierCode: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  phone: string;

  @Prop({ trim: true, lowercase: true, default: null })
  email?: string;

  @Prop({ trim: true, default: null })
  address?: string;

  @Prop({ required: true, default: 0 })
  balance: number; // يمثل المبالغ المستحقة للمورد (المديونية)

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ trim: true, default: null })
  notes?: string;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);

// عمل Text Index للبحث السريع بالاسم أو الكود أو الهاتف
SupplierSchema.index({ name: 'text', supplierCode: 'text', phone: 'text' });

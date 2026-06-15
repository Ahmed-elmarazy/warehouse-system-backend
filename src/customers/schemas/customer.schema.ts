import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ required: true, unique: true, trim: true, index: true })
  customerCode: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  phone: string;

  @Prop({ trim: true, lowercase: true, default: null })
  email?: string;

  @Prop({ trim: true, default: null })
  address?: string;

  @Prop({ required: true, default: 0 })
  currentDebt: number; // يمثل إجمالي الديون المستحقة على العميل للشركة

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ trim: true, default: null })
  notes?: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

// عمل إندكس مركب وتكست للبحث الشامل والسريع بالاسم أو الكود أو الهاتف
CustomerSchema.index({ name: 'text', customerCode: 'text', phone: 'text' });

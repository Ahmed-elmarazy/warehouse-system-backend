// 📄 src/customers/schemas/customer.schema.ts

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
  openingBalance: number; // 👈 الرصيد الافتتاحي المستحق عند التأسيس

  @Prop({ required: true, default: 0 })
  currentDebt: number; // يمثل الديون المستحقة من واقع الفواتير والسندات فقط

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ trim: true, default: null })
  notes?: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ name: 'text', customerCode: 'text', phone: 'text' });

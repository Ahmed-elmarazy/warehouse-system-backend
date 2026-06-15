import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsBoolean, IsOptional } from 'class-validator';
import { Document, Types } from 'mongoose';
import { Transform } from 'stream';

export type CategoryDocument = Category & Document & { _id: Types.ObjectId };

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ trim: true, default: null })
  description: string | null;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, refPath: 'createdByModel', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, refPath: 'updatedByModel', default: null })
  updatedBy: Types.ObjectId | null;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Index for fast name lookups and search
CategorySchema.index({ isActive: 1 });

CategorySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

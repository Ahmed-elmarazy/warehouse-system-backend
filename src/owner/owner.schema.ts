import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../common/enums/role.enum';

export type OwnerDocument = Owner & Document & { _id: Types.ObjectId }; // ← أضف ده

@Schema({ timestamps: true })
export class Owner {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Never expose this field in responses — see toJSON transform below
  @Prop({ required: true })
  password: string;

  @Prop({ type: String, enum: Role, default: Role.OWNER, immutable: true })
  role: Role;

  @Prop({ default: true })
  isActive: boolean;

  // OTP fields — optional, only populated during reset flow
  @Prop({ type: String, default: null })
  otp: string | null;

  @Prop({ type: Date, default: null })
  otpExpiresAt: Date | null;

  @Prop({ default: 'ROOT', unique: true })
  systemKey: string;
}

export const OwnerSchema = SchemaFactory.createForClass(Owner);

// Strip sensitive fields from every JSON response automatically
OwnerSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    // virtuals: true بيضيف id تلقائياً — مش محتاج تضيفه يدوي
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.otp;
    delete ret.otpExpiresAt;
    return ret;
  },
});

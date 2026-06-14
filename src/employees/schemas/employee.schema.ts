import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type EmployeeDocument = Employee & Document & { _id: Types.ObjectId };

@Schema({ timestamps: true })
export class Employee {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, enum: Role, default: Role.EMPLOYEE, immutable: true })
  role: Role;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ trim: true, default: null })
  phone: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Owner', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  // ─── OTP fields (same as Owner) ──────────────────────────────────────────────
  @Prop({ type: String, default: null })
  otp: string | null;

  @Prop({ type: Date, default: null })
  otpExpiresAt: Date | null;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);

EmployeeSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.otp;
    delete ret.otpExpiresAt;
    return ret;
  },
});

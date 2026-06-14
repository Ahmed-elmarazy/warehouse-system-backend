import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Owner, OwnerDocument } from './owner.schema';

@Injectable()
export class OwnerService {
  constructor(
    @InjectModel(Owner.name)
    private readonly ownerModel: Model<OwnerDocument>,
  ) {}

  // Create owner (no duplicate allowed via systemKey unique index)
  async createOwner(data: {
    fullName: string;
    email: string;
    password: string;
  }): Promise<OwnerDocument> {
    return this.ownerModel.create({
      ...data,
      email: data.email.toLowerCase(),
      systemKey: 'ROOT',
    });
  }

  async findByEmail(email: string): Promise<OwnerDocument | null> {
    return this.ownerModel
      .findOne({ email: email.toLowerCase() })
      .select('+password +otp +otpExpiresAt')
      .exec();
  }

  async findById(id: string): Promise<OwnerDocument | null> {
    return this.ownerModel.findById(id).exec();
  }

  async setOtp(email: string, otp: string, otpExpiresAt: Date): Promise<void> {
    await this.ownerModel.updateOne(
      { email: email.toLowerCase() },
      { otp, otpExpiresAt },
    );
  }

  async clearOtp(email: string): Promise<void> {
    await this.ownerModel.updateOne(
      { email: email.toLowerCase() },
      { otp: null, otpExpiresAt: null },
    );
  }

  async updatePassword(email: string, hashedPassword: string): Promise<void> {
    await this.ownerModel.updateOne(
      { email: email.toLowerCase() },
      {
        password: hashedPassword,
        otp: null,
        otpExpiresAt: null,
      },
    );
  }
}

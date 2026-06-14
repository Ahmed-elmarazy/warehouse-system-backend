import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Employee, EmployeeDocument } from './schemas/employee.schema';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────────────────
  async create(
    dto: CreateEmployeeDto,
    ownerId: string,
  ): Promise<EmployeeDocument> {
    const existing = await this.employeeModel
      .findOne({ email: dto.email.toLowerCase() })
      .exec();

    if (existing) {
      throw new ConflictException('An employee with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    return this.employeeModel.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      phone: dto.phone ?? null,
      createdBy: new Types.ObjectId(ownerId),
    });
  }

  // ─── Find All (paginated + search) ──────────────────────────────────────────
  async findAll(query: EmployeeQueryDto): Promise<{
    employees: EmployeeDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (search?.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter['$or'] = [{ fullName: regex }, { email: regex }, { phone: regex }];
    }

    const [employees, total] = await Promise.all([
      this.employeeModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.employeeModel.countDocuments(filter).exec(),
    ]);

    return {
      employees,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Find By ID ──────────────────────────────────────────────────────────────
  async findById(id: string): Promise<EmployeeDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid employee ID');
    }

    const employee = await this.employeeModel.findById(id).exec();
    if (!employee) throw new NotFoundException('Employee not found');

    return employee;
  }

  // ─── Find By Email (used in login) ──────────────────────────────────────────
  async findByEmail(email: string): Promise<EmployeeDocument | null> {
    return this.employeeModel
      .findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();
  }

  // ─── Update ──────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid employee ID');
    }

    if (dto.email) {
      const conflict = await this.employeeModel
        .findOne({ email: dto.email.toLowerCase(), _id: { $ne: id } })
        .exec();
      if (conflict) {
        throw new ConflictException(
          'This email is already used by another employee',
        );
      }
      dto.email = dto.email.toLowerCase();
    }

    const updated = await this.employeeModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Employee not found');
    return updated;
  }

  // ─── Soft Delete (deactivate) ────────────────────────────────────────────────
  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid employee ID');
    }

    const employee = await this.employeeModel.findById(id).exec();
    if (!employee) throw new NotFoundException('Employee not found');

    if (!employee.isActive) {
      throw new BadRequestException('Employee is already deactivated');
    }

    await this.employeeModel
      .findByIdAndUpdate(id, { $set: { isActive: false } })
      .exec();
  }

  // ─── Update Last Login ───────────────────────────────────────────────────────
  async updateLastLogin(id: string): Promise<void> {
    await this.employeeModel
      .findByIdAndUpdate(id, { $set: { lastLoginAt: new Date() } })
      .exec();
  }
  async setOtp(email: string, otp: string, otpExpiresAt: Date): Promise<void> {
    await this.employeeModel
      .updateOne({ email: email.toLowerCase() }, { otp, otpExpiresAt })
      .exec();
  }

  async clearOtp(email: string): Promise<void> {
    await this.employeeModel
      .updateOne(
        { email: email.toLowerCase() },
        { otp: null, otpExpiresAt: null },
      )
      .exec();
  }

  async updatePassword(email: string, hashedPassword: string): Promise<void> {
    await this.employeeModel
      .updateOne(
        { email: email.toLowerCase() },
        { password: hashedPassword, otp: null, otpExpiresAt: null },
      )
      .exec();
  }

  // findByEmail with OTP fields selected
  async findByEmailWithOtp(email: string): Promise<EmployeeDocument | null> {
    return this.employeeModel
      .findOne({ email: email.toLowerCase() })
      .select('+password +otp +otpExpiresAt')
      .exec();
  }
}

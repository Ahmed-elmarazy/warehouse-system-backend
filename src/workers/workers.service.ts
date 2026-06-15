import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose'; // 👈 ضفنا InjectConnection هنا
import { Connection, Model, Types } from 'mongoose';
import { Worker } from './schemas/worker.schema';
import { WorkerLog } from './schemas/worker-log.schema';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { AddPaymentDto } from './dto/add-payment.dto';

@Injectable()
export class WorkersService {
  constructor(
    @InjectModel(Worker.name) private workerModel: Model<Worker>,
    @InjectModel(WorkerLog.name) private workerLogModel: Model<WorkerLog>,
    @InjectConnection() private readonly connection: Connection, // 👈 كدا المحاذاة والحقن سليم 100%
  ) {}

  // 1. إضافة عامل جديد يدوياً
  async create(dto: CreateWorkerDto, userId: string): Promise<Worker> {
    const createdWorker = new this.workerModel({
      ...dto,
      createdBy: new Types.ObjectId(userId),
    });
    return await createdWorker.save();
  }

  // 2. البحث بالاسم والـ Pagination وحالة الأرشيف
  async findAll(search?: string, isActive = true) {
    const query: any = { isActive };
    if (search) {
      query.name = { $regex: search, $options: 'i' }; // بحث مرن بالاسم الجزئي (Case-insensitive)
    }
    return await this.workerModel.find(query).sort({ createdAt: -1 }).exec();
  }

  // 3. تعديل بيانات العامل الأساسية
  async update(id: string, dto: CreateWorkerDto): Promise<Worker> {
    const worker = await this.workerModel.findByIdAndUpdate(
      id,
      { $set: dto },
      { returnDocument: 'after' }, // التحديث المتوافق مع إصدارات مونجوس الجديدة بدون تحذيرات
    );
    if (!worker) throw new NotFoundException('Worker not found');
    return worker;
  }

  // 4. أرشفة عامل (تحويل حالة النشاط من وإلى الأرشيف)
  async toggleArchive(id: string, isActive: boolean): Promise<Worker> {
    const worker = await this.workerModel.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { returnDocument: 'after' },
    );
    if (!worker) throw new NotFoundException('Worker not found');
    return worker;
  }

  // 5. إضافة دفعة مالية للعامل (يومية/أسبوعية/شهرية) مع تحديث الإجمالي بالـ Transaction
  async addPayment(workerId: string, dto: AddPaymentDto, userId: string) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const worker = await this.workerModel.findById(workerId).session(session);
      if (!worker) throw new NotFoundException('Worker not found');

      // إنشاء السجل المالي للدفعة الحالية
      const log = new this.workerLogModel({
        workerId: worker._id,
        amount: dto.amount,
        periodType: dto.periodType,
        notes: dto.notes,
        createdBy: new Types.ObjectId(userId),
      });
      await log.save({ session });

      // تحديث إجمالي المدفوعات التراكمي في جدول العامل لضمان عزل البيانات وحمايتها
      worker.totalPaid += dto.amount;
      await worker.save({ session });

      await session.commitTransaction();
      session.endSession();

      return { success: true, message: 'Payment recorded successfully', log };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // 6. كشف حساب وسجل دفعات العامل بالكامل ليعرض في الـ History
  async getWorkerStatement(workerId: string) {
    const worker = await this.workerModel.findById(workerId).exec();
    if (!worker) throw new NotFoundException('Worker not found');

    const history = await this.workerLogModel
      .find({ workerId: worker._id })
      .sort({ createdAt: -1 }) // ترتيب من الأحدث للأقدم
      .exec();

    return {
      workerDetails: worker,
      totalPaid: worker.totalPaid,
      history,
    };
  }
}
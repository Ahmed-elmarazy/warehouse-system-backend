// 📄 src/payments/payments.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { CustomersService } from '../customers/customers.service';
import { EventEmitter2 } from '@nestjs/event-emitter'; // 👈 1. استيراد محرك الأحداث الجديد

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,

    @InjectModel('SalesInvoice')
    private readonly salesInvoiceModel: Model<any>,

    @InjectConnection()
    private readonly connection: Connection,

    private readonly customersService: CustomersService,

    private readonly eventEmitter: EventEmitter2, // 👈 2. حقن محرك الأحداث في الـ Constructor
  ) {}

  // ─── 1️⃣ إنشاء دفعة سداد جديدة بنظام الـ FIFO والـ Transactions ───────────
  async createPayment(
    dto: CreatePaymentDto,
    userId: string,
  ): Promise<PaymentDocument> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. التأكد من وجود العميل وجلب بياناته (بما فيها الرصيد الافتتاحي والحالي)
      const customer = await this.customersService.findById(dto.customerId);
      const customerObjectId = new Types.ObjectId(customer._id.toString());

      // 2. جلب الفواتير المفتوحة للعميل مرتبة من الأقدم للأحدث لتطبيق الـ FIFO
      const unpaidInvoices = await this.salesInvoiceModel
        .find({
          customerId: customerObjectId,
          isActive: true,
          remainingAmount: { $gt: 0 },
        })
        .sort({ createdAt: 1 })
        .session(session)
        .exec();

      // 3. حساب مديونية فواتير السيستم الحالية
      const actualInvoiceDebt = unpaidInvoices.reduce(
        (sum, inv) => sum + inv.remainingAmount,
        0,
      );

      // 🚀 [التعديل المحاسبي الجديد]: حساب إجمالي المديونية الشاملة (الافتتاحي + فواتير السيستم)
      const openingBalance = customer.openingBalance || 0;
      const totalDebt =
        Math.round((openingBalance + actualInvoiceDebt) * 100) / 100;

      // 🚨 التحقق الصارم الجديد من الخصم الزائد بناءً على المجموع الكلي
      if (dto.amount > totalDebt) {
        throw new BadRequestException(
          `Overpayment rejected! Customer total comprehensive debt is ${totalDebt} (Opening: ${openingBalance}, Invoices: ${actualInvoiceDebt}), but you tried to pay ${dto.amount}.`,
        );
      }

      let cacheAmountToDistribute = dto.amount;
      const affectedInvoiceIds: Types.ObjectId[] = [];

      // 🔄 محرك الـ FIFO لتوزيع مبلغ السداد على الفواتير المفتوحة (إن وُجدت)
      for (const invoice of unpaidInvoices) {
        if (cacheAmountToDistribute <= 0) break;

        affectedInvoiceIds.push(invoice._id as Types.ObjectId);

        if (cacheAmountToDistribute >= invoice.remainingAmount) {
          cacheAmountToDistribute -= invoice.remainingAmount;
          invoice.paidAmount += invoice.remainingAmount;
          invoice.remainingAmount = 0;
          invoice.paymentType = 'CASH';
        } else {
          invoice.paidAmount += cacheAmountToDistribute;
          invoice.remainingAmount -= cacheAmountToDistribute;
          invoice.paymentType = 'PARTIAL';
          cacheAmountToDistribute = 0;
        }

        await invoice.save({ session });
      }

      // 4. تسجيل وإصدار سند السداد المالي للـ Audit Trail
      const paymentNumber = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newPayment = new this.paymentModel({
        paymentNumber,
        customerId: customerObjectId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        relatedInvoices: affectedInvoiceIds,
        notes: dto.notes,
        createdBy: new Types.ObjectId(userId),
      });

      const savedPayment = await newPayment.save({ session });

      // 📉 تحديث مديونية العميل الإجمالية (يطرح المبلغ المدفوع بالكامل من الـ currentDebt)
      // ملحوظة: لو سدد من الـ Opening Balance، سيتجه الـ currentDebt للسالب، والمجموع (افتتاحي + حالي) سيكون دقيقاً 100%
      await this.customersService.updateCustomerDebt(
        customer._id.toString(),
        -dto.amount,
        session, // مررت الـ session لضمان الـ ACID والـ Rollback عند الفشل
      );

      await session.commitTransaction();
      session.endSession();

      // 🔔 إطلاق حدث استلام المقبوضات فوراً خارج الـ Transaction لـ WebSockets
      try {
        const customerData = customer as any;
        this.eventEmitter.emit('customer.payment.received', {
          id: savedPayment._id.toString(),
          paymentNumber: savedPayment.paymentNumber,
          amountReceived: savedPayment.amount,
          paymentMethod: savedPayment.paymentMethod,
          customerName:
            customerData?.fullName || customerData?.name || 'عميل سابق',
        });
      } catch (error) {
        console.error('Failed to emit payment notification event:', error);
      }

      return savedPayment;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      if (!session.hasEnded) {
        session.endSession();
      }
    }
  }

  // ─── 2️⃣ جلب كل السدادات بالـ Pagination والبحث المتقدم ───────────────────
  async findAllPayments(query: PaymentQueryDto): Promise<any> {
    const {
      page = 1,
      limit = 10,
      search,
      customerId,
      paymentMethod,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { isActive: true };

    if (search) {
      filter.paymentNumber = { $regex: search.trim(), $options: 'i' };
    }
    if (customerId && Types.ObjectId.isValid(customerId)) {
      filter.customerId = new Types.ObjectId(customerId);
    }
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .populate('customerId', 'name customerCode phone currentDebt')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.paymentModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── 3️⃣ جلب كل كشف مدفوعات عميل معين ─────────────────────────────────────
  async findPaymentsByCustomer(customerId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new BadRequestException('Invalid Customer ID format');
    }
    return await this.paymentModel
      .find({ customerId: new Types.ObjectId(customerId), isActive: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  // ─── 4️⃣ جلب حـركـة سـداد واحـدة بـالـ ID ──────────────────────────────────────
  async findPaymentById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Payment ID format');
    }

    const payment = await this.paymentModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .populate('customerId', 'name customerCode phone currentDebt')
      .populate('createdBy', 'name email')
      .lean()
      .exec();

    if (!payment) {
      throw new NotFoundException(`Payment record with ID "${id}" not found.`);
    }
    return payment;
  }

  // ─── 5️⃣ تحديث الملاحظات والسجلات تجميلياً فقط دون تغيير مالي ──────────────────
  async updatePaymentNotes(
    id: string,
    dto: UpdatePaymentDto,
  ): Promise<PaymentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Payment ID format');
    }
    const payment = await this.paymentModel
      .findByIdAndUpdate(id, { $set: { notes: dto.notes } }, { new: true })
      .exec();

    if (!payment) {
      throw new NotFoundException(`Payment record with ID "${id}" not found.`);
    }
    return payment;
  }

  // ─── 6️⃣ إلغاء حركة السداد (إعادة المديونية للفواتير بالتسلسل العكسي) ───────────
  async deletePayment(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Payment ID format');
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const payment = await this.paymentModel
        .findOne({ _id: new Types.ObjectId(id), isActive: true })
        .session(session);

      if (!payment) {
        throw new NotFoundException(
          `Payment record not found or already deleted.`,
        );
      }

      // تحويل حالة السند لغير نشط (Soft Delete)
      payment.isActive = false;
      await payment.save({ session });

      let cacheAmountToRevert = payment.amount;

      // جلب الفواتير التي تأثرت بهذا السداد لإرجاع مديونيتها (من الأحدث للأقدم)
      const relatedInvoices = await this.salesInvoiceModel
        .find({ _id: { $in: payment.relatedInvoices }, isActive: true })
        .sort({ createdAt: -1 })
        .session(session)
        .exec();

      for (const invoice of relatedInvoices) {
        if (cacheAmountToRevert <= 0) break;

        const maxRevertable = invoice.paidAmount;

        if (cacheAmountToRevert >= maxRevertable) {
          cacheAmountToRevert -= maxRevertable;
          invoice.remainingAmount += maxRevertable;
          invoice.paidAmount = 0;
          invoice.paymentType = 'CREDIT';
        } else {
          invoice.paidAmount -= cacheAmountToRevert;
          invoice.remainingAmount += cacheAmountToRevert;
          invoice.paymentType = 'PARTIAL';
          cacheAmountToRevert = 0;
        }

        await invoice.save({ session });
      }

      // إعادة توازن حقل الديون في موديول العميل
      await this.customersService.updateCustomerDebt(
        payment.customerId.toString(),
        payment.amount,
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

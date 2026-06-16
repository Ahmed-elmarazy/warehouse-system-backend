// 📄 src/customers/customers.service.ts

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
  ) {}

  async create(dto: CreateCustomerDto): Promise<CustomerDocument> {
    const existingPhone = await this.customerModel
      .findOne({ phone: dto.phone, isActive: true })
      .lean()
      .exec();
    if (existingPhone) {
      throw new ConflictException(
        `Customer with phone "${dto.phone}" already exists`,
      );
    }

    const timestamp = Date.now().toString().slice(-4);
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const customerCode = `CUST-${timestamp}-${randomDigits}-${new Date().getFullYear()}`;

    const customer = new this.customerModel({
      ...dto,
      customerCode,
      openingBalance: dto.openingBalance ?? 0, // 👈 حفظ الرصيد الافتتاحي
      currentDebt: 0,
    });

    return await customer.save();
  }

  async findAll(query: CustomerQueryDto): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { isActive: true };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { customerCode: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [rawCustomers, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);

    // دمج الحسبة تلقائياً لكل عميل في قائمة العرض للفرونت إند للشفافية
    const data = rawCustomers.map((cust) => ({
      ...cust,
      totalOutstandingDebt:
        Math.round(
          ((cust.openingBalance || 0) + (cust.currentDebt || 0)) * 100,
        ) / 100,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<CustomerDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid Customer ID format');
    const customer = await this.customerModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .exec();
    if (!customer)
      throw new NotFoundException(`Customer with ID "${id}" not found`);
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerDocument> {
    const customer = await this.findById(id);

    if (dto.phone && dto.phone !== customer.phone) {
      const duplicate = await this.customerModel
        .findOne({ phone: dto.phone, isActive: true })
        .lean()
        .exec();
      if (duplicate)
        throw new ConflictException(
          `Customer with phone "${dto.phone}" already exists`,
        );
    }

    return await this.customerModel
      .findByIdAndUpdate(customer._id, { $set: dto }, { new: true })
      .exec();
  }

  async remove(id: string): Promise<{ message: string }> {
    const customer = await this.findById(id);
    await this.customerModel
      .findByIdAndUpdate(customer._id, { $set: { isActive: false } })
      .exec();
    return {
      message: `Customer "${customer.name}" has been soft-deleted successfully`,
    };
  }

  async updateCustomerDebt(
    customerId: string,
    amount: number,
    session?: any,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(customerId))
      throw new BadRequestException('Invalid Customer ID for debt operation');
    const safeAmount = Math.round(amount * 100) / 100;

    const result = await this.customerModel
      .findByIdAndUpdate(
        new Types.ObjectId(customerId),
        { $inc: { currentDebt: safeAmount } },
        { new: true, session },
      )
      .exec();

    if (!result)
      throw new NotFoundException(
        `Customer with ID "${customerId}" not found for debt execution`,
      );
  }

  // ─── كشف الحساب المالي المطور بدمج الرصيد الافتتاحي ───
  async getCustomerStatement(id: string): Promise<any> {
    const customer = await this.findById(id);

    const salesInvoiceModel = this.customerModel.db.model('SalesInvoice');
    const paymentModel = this.customerModel.db.model('Payment');
    const customerReturnModel = this.customerModel.db.model('CustomerReturn');

    const [invoices, payments, returns] = await Promise.all([
      salesInvoiceModel
        .find({ customerId: customer._id, isActive: true })
        .lean()
        .exec(),
      paymentModel
        .find({ customerId: customer._id, isActive: true })
        .lean()
        .exec(),
      customerReturnModel
        .find({ customerId: customer._id, isActive: true })
        .lean()
        .exec(),
    ]);

    const totalSalesAmount = invoices.reduce(
      (sum: number, inv: any) => sum + (inv.finalAmount || 0),
      0,
    );
    const totalPaidFromInvoices = invoices.reduce(
      (sum: number, inv: any) => sum + (inv.paidAmount || 0),
      0,
    );
    const totalInvoiceRemaining = invoices.reduce(
      (sum: number, inv: any) => sum + (inv.remainingAmount || 0),
      0,
    );

    const totalCreditReturns = returns
      .filter((ret: any) => ret.returnType === 'CREDIT')
      .reduce((sum: number, ret: any) => sum + (ret.totalAmount || 0), 0);

    // 🛡️ صمام الأمان: المديونية تشمل الـ Opening Balance ولكن الـ totalPurchasedAmount (المبيعات للداش بورد) تظل نظيفة تماماً!
    const openingBalance = customer.openingBalance || 0;
    const rawOutstandingDebt =
      openingBalance + totalInvoiceRemaining - totalCreditReturns;
    const currentOutstandingDebt = Math.round(rawOutstandingDebt * 100) / 100;

    // تجهيز كشف الحركات التجميعي التاريخي وتضمين الرصيد الافتتاحي كأول حركة دايماً
    const timeline: any[] = [
      {
        type: 'OPENING_BALANCE',
        referenceId: 'START-BAL',
        amount: openingBalance,
        date: (customer as any).createdAt,
        notes: 'الرصيد المالي الافتتاحي للمديونية السابقة',
      },
    ];

    return {
      customerInfo: {
        id: customer._id,
        name: customer.name,
        customerCode: customer.customerCode,
        phone: customer.phone,
        openingBalance,
        actualSavedDebt: customer.currentDebt,
        totalRequiredDebt: openingBalance + customer.currentDebt, // إجمالي المطلوب النهائي من العميل
      },
      financialSummary: {
        totalPurchasedAmount: Math.round(totalSalesAmount * 100) / 100, // المبيعات صافية 100% للداش بورد
        totalPaidAmount: Math.round(totalPaidFromInvoices * 100) / 100,
        totalCreditReturnsAmount: Math.round(totalCreditReturns * 100) / 100,
        currentOutstandingDebt: Math.max(0, currentOutstandingDebt),
        totalPaymentReceiptsCount: payments.length,
      },
      history: {
        statementTimeline: timeline, // يمكن دمج باقي الفواتير والسندات في الفرونت إند هنا
        invoices: invoices.map((inv: any) => ({
          invoiceNumber: inv.invoiceNumber,
          finalAmount: inv.finalAmount,
          paidAmount: inv.paidAmount,
          remainingAmount: inv.remainingAmount,
          paymentType: inv.paymentType,
          date: inv.date,
        })),
        payments: payments.map((pay: any) => ({
          paymentNumber: pay.paymentNumber,
          amount: pay.amount,
          paymentMethod: pay.paymentMethod,
          date: pay.createdAt,
        })),
        returns: returns.map((ret: any) => ({
          returnNumber: ret.returnNumber,
          totalAmount: ret.totalAmount,
          returnType: ret.returnType,
          reason: ret.reason,
          date: ret.createdAt,
        })),
      },
    };
  }
}

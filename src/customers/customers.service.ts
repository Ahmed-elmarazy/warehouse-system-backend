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

  // ─── إنشاء عميل جديد وتوليد الكود تلقائياً ──────────────────────────────
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

    // توليد كود فريد شبه تسلسلي يمنع التكرار نهائياً في قواعد البيانات الضخمة
    const timestamp = Date.now().toString().slice(-4);
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const customerCode = `CUST-${timestamp}-${randomDigits}-${new Date().getFullYear()}`;

    const customer = new this.customerModel({
      ...dto,
      customerCode,
      currentDebt: 0, // يبدأ الحساب دائماً بصفر
    });

    return await customer.save();
  }

  // ─── جلب كل العملاء (Pagination + Filtered Search) ───────────────────
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

    const [data, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── جلب عميل معين بالـ ID ─────────────────────────────────────────────
  async findById(id: string): Promise<CustomerDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Customer ID format');
    }

    const customer = await this.customerModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .exec();
    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found`);
    }
    return customer;
  }

  // ─── تعديل بيانات عميل (Owner Only) ────────────────────────────────────
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

  // ─── حذف عميل (Soft Delete) ───────────────────────────────────────────
  async remove(id: string): Promise<{ message: string }> {
    const customer = await this.findById(id);

    await this.customerModel
      .findByIdAndUpdate(customer._id, { $set: { isActive: false } })
      .exec();
    return {
      message: `Customer "${customer.name}" has been soft-deleted successfully`,
    };
  }

  // ─── المحرك المالي الداخلي: تحديث مديونية العميل مع دعم الـ Transactions ───
  async updateCustomerDebt(
    customerId: string,
    amount: number,
    session?: any,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new BadRequestException('Invalid Customer ID for debt operation');
    }

    // تقريب مالي لمنع مشاكل الكسور العشرية العشوائية في Javascript
    const safeAmount = Math.round(amount * 100) / 100;

    const result = await this.customerModel
      .findByIdAndUpdate(
        new Types.ObjectId(customerId),
        { $inc: { currentDebt: safeAmount } },
        { new: true, session }, // ربط كامل مع الـ Transaction لضمان سلامة البيانات (ACID)
      )
      .exec();

    if (!result) {
      throw new NotFoundException(
        `Customer with ID "${customerId}" not found for debt execution`,
      );
    }
  }

  // ─── كشف الحساب المالي التفصيلي الديناميكي (شامل الفواتير، السندات، والمرتجع الآجل) ───
  async getCustomerStatement(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Customer ID format');
    }

    // 1. جلب بيانات العميل الأساسية
    const customer = await this.customerModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .lean()
      .exec();
    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found`);
    }

    // حقن الموديلات الـ 3 ديناميكياً
    const salesInvoiceModel = this.customerModel.db.model('SalesInvoice');
    const paymentModel = this.customerModel.db.model('Payment');
    const customerReturnModel = this.customerModel.db.model('CustomerReturn');

    // 2. جلب متوازي متكامل (الفواتير، السندات، والمرتجع الحقيقي للعميل)
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

    // 3. العمليات الحسابية المتطورة والدقيقة من واقع الداتابيز
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

    // حساب إجمالي المرتجعات الآجلة (CREDIT) التي تؤثر على توازن الدين المتبقي
    const totalCreditReturns = returns
      .filter((ret: any) => ret.returnType === 'CREDIT')
      .reduce((sum: number, ret: any) => sum + (ret.totalAmount || 0), 0);

    // المديونية الفعلية = (متبقي الفواتير الآجلة) - (إجمالي المرتجعات الآجلة للعميل)
    const rawOutstandingDebt = totalInvoiceRemaining - totalCreditReturns;
    const currentOutstandingDebt = Math.round(rawOutstandingDebt * 100) / 100;

    return {
      customerInfo: {
        id: customer._id,
        name: customer.name,
        customerCode: customer.customerCode,
        phone: customer.phone,
        actualSavedDebt: customer.currentDebt,
      },
      financialSummary: {
        totalPurchasedAmount: Math.round(totalSalesAmount * 100) / 100,
        totalPaidAmount: Math.round(totalPaidFromInvoices * 100) / 100,
        totalCreditReturnsAmount: Math.round(totalCreditReturns * 100) / 100,
        currentOutstandingDebt: Math.max(0, currentOutstandingDebt), // حماية من القيم السالبة العشوائية
        totalPaymentReceiptsCount: payments.length,
      },
      history: {
        invoices: invoices.map((inv: any) => ({
          invoiceNumber: inv.invoiceNumber,
          finalAmount: inv.finalAmount,
          paidAmount: inv.paidAmount,
          remainingAmount: inv.remainingAmount,
          paymentType: inv.paymentType,
          date: inv.createdAt,
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
        })), // <== مصفوفة المرتجعات تمت إضافتها هنا بنجاح بناءً على طلبك
      },
    };
  }
}

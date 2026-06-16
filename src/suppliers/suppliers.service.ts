// 📄 src/suppliers/suppliers.service.ts

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Supplier, SupplierDocument } from './schemas/supplier.schema';
import {
  SupplierPayment,
  SupplierPaymentDocument,
} from './schemas/supplier-payment.schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,

    @InjectModel(SupplierPayment.name)
    private readonly supplierPaymentModel: Model<SupplierPaymentDocument>,

    @InjectModel('PurchaseInvoice')
    private readonly purchaseInvoiceModel: Model<any>,

    @InjectModel('SupplierReturn')
    private readonly supplierReturnModel: Model<any>,
  ) {}

  async create(dto: CreateSupplierDto): Promise<SupplierDocument> {
    const existingPhone = await this.supplierModel
      .findOne({ phone: dto.phone, isActive: true })
      .lean()
      .exec();
    if (existingPhone) {
      throw new ConflictException(
        `Supplier with phone "${dto.phone}" already exists`,
      );
    }

    const supplierCode = `SUP-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;

    const supplier = new this.supplierModel({
      ...dto,
      supplierCode,
      openingBalance: dto.openingBalance ?? 0, // 👈 حفظ الرصيد الافتتاحي للمورد
      balance: 0,
    });

    return await supplier.save();
  }

  async findAll(
    query: SupplierQueryDto,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, search, includeInactive } = query;
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};

    if (!includeInactive) filter.isActive = true;

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { supplierCode: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [rawSuppliers, total] = await Promise.all([
      this.supplierModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.supplierModel.countDocuments(filter).exec(),
    ]);

    // عرض صافي المستحقات الشاملة للفرونت إند تلقائياً
    const data = rawSuppliers.map((sup) => ({
      ...sup,
      totalOutstandingBalance:
        Math.round(((sup.openingBalance || 0) + (sup.balance || 0)) * 100) /
        100,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<SupplierDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid Supplier ID format');
    const supplier = await this.supplierModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .exec();
    if (!supplier)
      throw new NotFoundException(`Supplier with ID "${id}" not found`);
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid Supplier ID format');
    const supplier = await this.supplierModel.findById(id).exec();
    if (!supplier)
      throw new NotFoundException(`Supplier with ID "${id}" not found`);

    if (dto.phone && dto.phone !== supplier.phone) {
      const duplicate = await this.supplierModel
        .findOne({ phone: dto.phone, isActive: true })
        .lean()
        .exec();
      if (duplicate)
        throw new ConflictException(
          `Supplier with phone "${dto.phone}" already exists`,
        );
    }

    return await this.supplierModel
      .findByIdAndUpdate(
        supplier._id,
        { $set: dto },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async remove(id: string): Promise<{ message: string }> {
    const supplier = await this.findById(id);
    await this.supplierModel
      .findByIdAndUpdate(supplier._id, { $set: { isActive: false } })
      .exec();
    return {
      message: `Supplier "${supplier.name}" has been soft-deleted successfully`,
    };
  }

  async updateSupplierBalance(
    supplierId: string,
    amount: number,
    session?: any,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(supplierId))
      throw new BadRequestException('Invalid Supplier ID for balance update');
    const updateOptions = session
      ? { session, returnDocument: 'after' as const }
      : { returnDocument: 'after' as const };

    const result = await this.supplierModel
      .findByIdAndUpdate(
        new Types.ObjectId(supplierId),
        { $inc: { balance: amount } },
        updateOptions,
      )
      .exec();

    if (!result)
      throw new NotFoundException(
        `Supplier with ID "${supplierId}" not found for balance execution`,
      );
  }

  async createPayment(
    supplierId: string,
    dto: CreateSupplierPaymentDto,
    userId: string,
  ): Promise<SupplierPaymentDocument> {
    const supplier = await this.findById(supplierId);

    const payment = new this.supplierPaymentModel({
      supplierId: supplier._id,
      amount: dto.amount,
      notes: dto.notes,
      createdBy: new Types.ObjectId(userId),
    });

    const savedPayment = await payment.save();
    await this.updateSupplierBalance(supplier._id.toString(), -dto.amount);
    return savedPayment;
  }

  // ─── كشف حساب المورد الشامل بعد دمج الرصيد الافتتاحي المستحق ───
  async getStatement(
    supplierId: string,
  ): Promise<{
    totalPurchased: number;
    totalPaid: number;
    remainingDebt: number;
    history: any[];
  }> {
    const supplier = await this.findById(supplierId);

    const [invoices, payments, returns] = await Promise.all([
      this.purchaseInvoiceModel
        .find({ supplierId: supplier._id.toString(), isActive: true })
        .lean()
        .exec(),
      this.supplierPaymentModel
        .find({ supplierId: supplier._id })
        .lean()
        .exec(),
      this.supplierReturnModel
        .find({ supplierId: supplier._id.toString() })
        .lean()
        .exec(),
    ]);

    const totalPurchased = invoices.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0,
    );
    const totalPaid = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
    const totalReturned = returns.reduce(
      (sum, ret) => sum + (ret.totalAmount || 0),
      0,
    );

    // تضمين الرصيد الافتتاحي كأول مستند مالي مسجل في تاريخ التوريد
    const history: any[] = [
      {
        type: 'OPENING_BALANCE',
        referenceId: 'START-BAL',
        amount: supplier.openingBalance || 0,
        date: (supplier as any).createdAt,
        notes: 'الرصيد الافتتاحي المالي المستحق للمورد أول المدة',
      },
    ];

    invoices.forEach((inv) => {
      history.push({
        type: 'PURCHASE_INVOICE',
        referenceId: inv.invoiceNumber,
        amount: inv.totalAmount,
        date: inv.createdAt,
        notes: 'فاتورة شراء بضائع واردة',
      });
    });

    payments.forEach((pay) => {
      history.push({
        type: 'SUPPLIER_PAYMENT',
        referenceId: pay._id.toString().slice(-6).toUpperCase(),
        amount: pay.amount,
        date: pay.createdAt,
        notes: pay.notes || 'سند صرف دفعة نقدية للمورد',
      });
    });

    returns.forEach((ret) => {
      history.push({
        type: 'SUPPLIER_RETURN',
        referenceId: ret.returnNumber,
        amount: ret.totalAmount,
        date: ret.createdAt,
        notes: ret.reason || 'مرتجع بضائع إلى المورد',
      });
    });

    history.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      totalPurchased, // يظل صافي لتقارير المشتريات بدون تضخم
      totalPaid,
      remainingDebt:
        Math.round(((supplier.openingBalance || 0) + supplier.balance) * 100) /
        100, // المديونية النهائية الشاملة
      history,
    };
  }
}

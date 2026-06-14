import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Supplier, SupplierDocument } from './schemas/supplier.schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
  ) {}

  // ─── إنشاء مورد جديد مع توليد الكود آلياً ──────────────────────────────────
  async create(dto: CreateSupplierDto): Promise<SupplierDocument> {
    // التحقق من عدم تكرار رقم الهاتف
    const existingPhone = await this.supplierModel
      .findOne({ phone: dto.phone, isActive: true })
      .lean()
      .exec();
    if (existingPhone) {
      throw new ConflictException(
        `Supplier with phone "${dto.phone}" already exists`,
      );
    }

    // توليد كود تلقائي فريد للمورد (مثال: SUP-17178523)
    const supplierCode = `SUP-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;

    const supplier = new this.supplierModel({
      ...dto,
      supplierCode,
      balance: 0, // الحساب يبدأ من صفر دائماً
    });

    return await supplier.save();
  }

  // ─── جلب كل الموردين (Pagination + Filtered Search) ──────────────────────

  // ─── جلب الموردين مع دعم الأرشيف ──────────────────────────────────
  async findAll(query: SupplierQueryDto): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, search, includeInactive } = query; // 👈 استخراج includeInactive
    const skip = (page - 1) * limit;

    // بناء الفلتر ديناميكياً
    const filter: Record<string, any> = {};

    // لو الـ includeInactive مش مبعوت أو بـ false، نلتزم بجلب الموردين النشطين فقط
    if (!includeInactive) {
      filter.isActive = true;
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { supplierCode: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.supplierModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.supplierModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── جلب مورد معين بالـ ID ────────────────────────────────────────────────
  async findById(id: string): Promise<SupplierDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Supplier ID format');
    }

    const supplier = await this.supplierModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .exec();
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID "${id}" not found`);
    }
    return supplier;
  }

  // ─── تعديل بيانات مورد (Owner Only) ──────────────────────────────────────
  // ─── تعديل بيانات مورد (تحديث شامل ودعم إعادة التفعيل) ──────────────────
  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Supplier ID format');
    }

    // 1. نبحث عن المورد بالـ ID فقط بدون شرط الـ isActive عشان لو ممسوح soft delete نقدر نمسكه ونعدله
    const supplier = await this.supplierModel.findById(id).exec();
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID "${id}" not found`);
    }

    // 2. التحقق من عدم تكرار رقم الهاتف مع مورد آخر (نشط)
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

    // 3. الحفظ والتعديل الفعلي (لو مبعوت isActive: true هينزل يتعدل في الداتابيز علطول)
    return await this.supplierModel
      .findByIdAndUpdate(supplier._id, { $set: dto }, { new: true })
      .exec();
  }
  // ─── حذف مورد (Soft Delete) ──────────────────────────────────────────────
  async remove(id: string): Promise<{ message: string }> {
    const supplier = await this.findById(id);

    await this.supplierModel
      .findByIdAndUpdate(supplier._id, { $set: { isActive: false } })
      .exec();

    return {
      message: `Supplier "${supplier.name}" has been soft-deleted successfully`,
    };
  }

  // ─── دالة الربط الداخلي للسيستم (تحديث رصيد المورد آلياً عند الفواتير والمرتجعات) ───
  async updateSupplierBalance(
    supplierId: string,
    amount: number,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(supplierId)) {
      throw new BadRequestException('Invalid Supplier ID for balance update');
    }

    // الـ amount هيمر موجب في حالة فاتورة الشراء وسالب في حالة المرتجعات
    const result = await this.supplierModel
      .findByIdAndUpdate(
        new Types.ObjectId(supplierId),
        { $inc: { balance: amount } },
        { new: true },
      )
      .exec();

    if (!result) {
      throw new NotFoundException(
        `Supplier with ID "${supplierId}" not found for balance execution`,
      );
    }
  }
}

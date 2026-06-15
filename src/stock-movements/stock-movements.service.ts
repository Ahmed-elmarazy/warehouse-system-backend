// 📄 src/stock-movements/stock-movements.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StockMovement,
  StockMovementDocument,
} from './schemas/stock-movement.schema';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { EventEmitter2 } from '@nestjs/event-emitter'; // 👈 1. استيراد محرك الأحداث الجديد

@Injectable()
export class StockMovementsService {
  constructor(
    @InjectModel(StockMovement.name)
    private readonly stockMovementModel: Model<StockMovementDocument>,

    @InjectModel('Product')
    private readonly productModel: Model<any>,

    private readonly eventEmitter: EventEmitter2, // 👈 2. حقن محرك الأحداث داخل الـ Constructor
  ) {}

  // ─── جلب كل الحركات (Pagination + Filters + Date Range) ──────────────────
  async findAllMovements(query: StockMovementQueryDto): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, productId, type, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (productId) {
      filter.productId = new Types.ObjectId(productId);
    }

    if (type) {
      filter.type = type;
    }

    // فلترة التواريخ المتقدمة للتقارير الجردية
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // لجعل نهاية اليوم شاملة 23:59:59
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.stockMovementModel
        .find(filter)
        .populate('productId', 'name code piecePrice')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.stockMovementModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── جلب حركة معينة بالـ ID ──────────────────────────────────────────────
  async findMovementById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Stock Movement ID');
    }

    const movement = await this.stockMovementModel
      .findById(id)
      .populate('productId', 'name code piecePrice piecesPerCarton')
      .populate('createdBy', 'name email')
      .lean()
      .exec();

    if (!movement) {
      throw new NotFoundException(
        `Stock Movement log with ID "${id}" not found`,
      );
    }

    return movement;
  }

  // ─── المحرك الأساسي: تسجيل حركة وتعديل مخزن المنتج (المبيعات، المشتريات، إلخ) ───
  async createMovement(
    dto: CreateStockMovementDto,
    userId: string,
  ): Promise<StockMovementDocument> {
    if (!Types.ObjectId.isValid(dto.productId)) {
      throw new BadRequestException('Invalid Product ObjectId');
    }

    const productObjectId = new Types.ObjectId(dto.productId);

    // 1. جلب المنتج الحالي والتأكد من وجوده ونشاطه
    const product = await this.productModel.findOne({
      _id: productObjectId,
      isActive: true,
    });
    if (!product) {
      throw new NotFoundException(
        `Active Product with ID "${dto.productId}" not found`,
      );
    }

    const quantityBefore = product.quantityInPieces;
    let quantityChanged = Math.abs(dto.quantityChanged); // نضمن أن الرقم القادم موجب
    let quantityAfter = quantityBefore;

    // 2. تطبيق حركات الحساب بناء على نوع الحركة المرسلة
    switch (dto.type) {
      case 'PURCHASE':
      case 'CUSTOMER_RETURN':
        // الشراء ومرتجع العميل يزود المخزن
        quantityAfter = quantityBefore + quantityChanged;
        break;

      case 'SALE':
      case 'SUPPLIER_RETURN':
        // البيع ومرتجع المورد ينقص المخزن
        quantityChanged = -quantityChanged; // تحويل الإشارة لسالب للتدقيق
        quantityAfter = quantityBefore + quantityChanged;
        break;

      case 'ADJUSTMENT':
        // التعديل اليدوي (الجرد السنوي مثلاً) قد يكون بالزيادة أو النقصان بناء على المدخل الأصلي للـ DTO
        quantityChanged = dto.quantityChanged;
        quantityAfter = quantityBefore + quantityChanged;
        break;

      default:
        throw new BadRequestException(`Unknown movement type: ${dto.type}`);
    }

    // 3. الصمام الأمان الصارم: المخزن لا يمكن أن يصبح سالبًا أبداً!
    if (quantityAfter < 0) {
      throw new BadRequestException(
        `Inadequate stock! Transaction rejected. Product "${product.name}" has ${quantityBefore} pieces available, requested change is ${quantityChanged} pieces.`,
      );
    }

    // 4. تحديث حقل المخزن جوه كوليكشن الـ Product
    product.quantityInPieces = quantityAfter;
    product.updatedBy = new Types.ObjectId(userId);
    await product.save();

    // 5. حفظ السجل الكامل للحركة وعمل الـ Audit Trail
    const movement = new this.stockMovementModel({
      productId: productObjectId,
      type: dto.type,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId || null,
      quantityBefore,
      quantityChanged,
      quantityAfter,
      notes: dto.notes || null,
      createdBy: new Types.ObjectId(userId),
    });

    const savedMovement = await movement.save();

    try {
      this.eventEmitter.emit('stock.movement.updated', {
        productId: product._id.toString(),
        productName: product.name,
        newQty: quantityAfter, // الرصيد الفعلي الحالي
        minQty: product.minimumQuantity, // الحد الأدنى الديناميكي من كارت الصنف
        maxQty: product.maximumQuantity, // الحد الأقصى الديناميكي من كارت الصنف
      });
    } catch (error) {
      console.error('Failed to emit stock movement notification event:', error);
    }

    return savedMovement;
  }
}

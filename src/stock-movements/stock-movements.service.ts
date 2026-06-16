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
        // 🚀 التعديل المطلوب: إضافة piecesPerCarton لدعم الحسبة في الفرونت إند
        .populate('productId', 'name code piecePrice piecesPerCarton')
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
    session?: any, // 👈 إدخال الـ session هنا لدعم الـ Transactions
  ): Promise<StockMovementDocument> {
    if (!Types.ObjectId.isValid(dto.productId)) {
      throw new BadRequestException('Invalid Product ObjectId');
    }

    const productObjectId = new Types.ObjectId(dto.productId);

    // 1. جلب المنتج الحالي داخل الـ session لضمان عزل البيانات وحمايتها من الـ Race Conditions
    const product = await this.productModel
      .findOne({
        _id: productObjectId,
        isActive: true,
      })
      .session(session); // 👈 ربط الاستعلام بالـ session

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
        quantityAfter = quantityBefore + quantityChanged;
        break;

      case 'SALE':
      case 'SUPPLIER_RETURN':
        quantityChanged = -quantityChanged; // تحويل الإشارة لسالب للتدقيق
        quantityAfter = quantityBefore + quantityChanged;
        break;

      case 'ADJUSTMENT':
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

    // 4. تحديث حقل المخزن جوه كوليكشن الـ Product مع تمرير الـ session
    product.quantityInPieces = quantityAfter;
    product.updatedBy = new Types.ObjectId(userId);
    await product.save({ session }); // 👈 الحفظ داخل الـ session

    // 5. حفظ السجل الكامل للحركة وعمل الـ Audit Trail مع تمرير الـ session
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

    const savedMovement = await movement.save({ session }); // 👈 الحفظ داخل الـ session

    // 💡 الإشعارات والـ Events يتم إطلاقها فقط خارج نطاق الـ Transaction أو بعد الـ Commit
    // لأننا لو أطلقناها هنا وفشلت الفاتورة بعد ثانية، السيستم هيبعت إشعارات وهمية للمستخدمين!
    if (!session) {
      try {
        this.eventEmitter.emit('stock.movement.updated', {
          productId: product._id.toString(),
          productName: product.name,
          newQty: quantityAfter,
          minQty: product.minimumQuantity,
          maxQty: product.maximumQuantity,
        });
      } catch (error) {
        console.error(
          'Failed to emit stock movement notification event:',
          error,
        );
      }
    } else {
      // لو إحنا جوه Transaction، يفضل تسجيل الحدث ليتم إطلاقه بعد نجاح الـ Commit بالكامل في السيرفيس الأساسي
    }

    return savedMovement;
  }
}

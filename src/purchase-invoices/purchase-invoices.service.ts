// 📄 src/purchase-invoices/purchase-invoices.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PurchaseInvoice,
  PurchaseInvoiceDocument,
} from './schemas/purchase-invoice.schema';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { PurchaseInvoiceQueryDto } from './dto/purchase-invoice-query.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { EventEmitter2 } from '@nestjs/event-emitter'; // 👈 1. استيراد محرك الأحداث الجديد

@Injectable()
export class PurchaseInvoicesService {
  constructor(
    @InjectModel(PurchaseInvoice.name)
    private readonly purchaseInvoiceModel: Model<PurchaseInvoiceDocument>,

    @InjectModel('Product')
    private readonly productModel: Model<any>,

    private readonly stockMovementsService: StockMovementsService,
    private readonly suppliersService: SuppliersService,

    private readonly eventEmitter: EventEmitter2, // 👈 2. حقن محرك الأحداث في الـ Constructor
  ) {}

  async createInvoice(
    dto: CreatePurchaseInvoiceDto,
    userId: string,
  ): Promise<PurchaseInvoiceDocument> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'Purchase invoice must contain at least one item',
      );
    }

    // ─── 🛑 1. هندسة توليد رقم الفاتورة المتسلسل تلقائياً 🛑 ───
    // البحث عن أحدث فاتورة تم إنشاؤها في النظام لقراءة رقمها
    const lastInvoice = await this.purchaseInvoiceModel
      .findOne({}, { invoiceNumber: 1 })
      .sort({ createdAt: -1 }) // الترتيب التنازلي يجلب الأحدث أولاً
      .lean()
      .exec();

    let nextSerialNumber = 1;

    if (lastInvoice && lastInvoice.invoiceNumber) {
      // تفكيك الرقم القديم؛ على سبيل المثال لو كان "INV-PUR-0024"
      // الـ split هتقسم النص بناءً على الشرطة "-" ونأخذ الجزء الأخير "0024" ونحوله لرقم حقيقي 24
      const parts = lastInvoice.invoiceNumber.split('-');
      const lastNumber = parseInt(parts[parts.length - 1], 10);

      if (!isNaN(lastNumber)) {
        nextSerialNumber = lastNumber + 1; // زيادة العداد بمقدار 1
      }
    }

    // تنسيق الرقم الجديد ليكون مكوناً من 4 خانات بإضافة أصفار على اليسار (مثل: 0005)
    const formattedNumber = String(nextSerialNumber).padStart(4, '0');
    const invoiceNumber = `INV-PUR-${formattedNumber}`;
    // ──────────────────────────────────────────────────────────

    let calculatedTotalAmount = 0;
    const processedItems = [];

    for (const item of dto.items) {
      if (!Types.ObjectId.isValid(item.productId)) {
        throw new BadRequestException(`Invalid Product ID: ${item.productId}`);
      }

      const product = await this.productModel.findOne({
        _id: new Types.ObjectId(item.productId),
        isActive: true,
      });
      if (!product) {
        throw new NotFoundException(
          `Product with ID "${item.productId}" not found or is inactive`,
        );
      }

      const finalCartonPrice =
        item.cartonPrice !== undefined ? item.cartonPrice : product.cartonPrice;
      const finalPiecePrice =
        item.piecePrice !== undefined ? item.piecePrice : product.piecePrice;
      const conversionFactor = product.piecesPerCarton;

      const totalPieces = item.cartons * conversionFactor + item.pieces;
      if (totalPieces <= 0) {
        throw new BadRequestException(
          `Total units for product "${product.name}" must be greater than 0 pieces.`,
        );
      }

      const itemTotalPrice =
        item.cartons * finalCartonPrice + item.pieces * finalPiecePrice;
      calculatedTotalAmount += itemTotalPrice;

      processedItems.push({
        productId: product._id,
        cartons: item.cartons,
        pieces: item.pieces,
        cartonPrice: finalCartonPrice,
        piecePrice: finalPiecePrice,
        totalPieces,
        total: itemTotalPrice,
      });
    }

    // حفظ الفاتورة بالرقم السيريال المتسلسل الجديد والبيانات المالية الصحيحة
    const newInvoice = new this.purchaseInvoiceModel({
      invoiceNumber,
      supplierId: dto.supplierId,
      items: processedItems,
      totalAmount: calculatedTotalAmount,
      createdBy: new Types.ObjectId(userId),
    });

    const savedInvoice = await newInvoice.save();

    // استدعاء محرك المخزن والـ Audit Trail بالـ totalPieces والـ Serial الجديد
    for (const pItem of processedItems) {
      await this.stockMovementsService.createMovement(
        {
          productId: pItem.productId.toString(),
          type: 'PURCHASE',
          referenceType: 'PURCHASE_INVOICE',
          referenceId: invoiceNumber, // ربط الحركة بالرقم المتسلسل الجديد
          quantityChanged: pItem.totalPieces,
          notes: `Automated WMS conversion incoming: ${pItem.cartons} cartons & ${pItem.pieces} loose pieces.`,
        },
        userId,
      );
    }

    // 3. تحديث حساب المورد تلقائياً بـ إجمالي الفاتورة
    await this.suppliersService.updateSupplierBalance(
      savedInvoice.supplierId,
      savedInvoice.totalAmount,
    );

    // ─── 🔔 4. إطلاق حدث إنشاء فاتورة شراء جديدة تلقائياً لنظام التنبيهات ───
    try {
      const invoiceData = savedInvoice as any;
      this.eventEmitter.emit('purchase.invoice.created', {
        id: invoiceData._id.toString(),
        invoiceNumber: invoiceData.invoiceNumber,
        finalAmount: invoiceData.totalAmount,
        supplierName: invoiceData.supplierId?.toString() || 'مورد النظام',
      });
    } catch (error) {
      console.error(
        'Failed to emit purchase invoice notification event:',
        error,
      );
    }

    return savedInvoice;
  }

  async findAllInvoices(query: PurchaseInvoiceQueryDto): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      supplierId,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { isActive: true };

    if (search) {
      filter.invoiceNumber = { $regex: search.trim(), $options: 'i' };
    }

    if (supplierId) {
      if (!Types.ObjectId.isValid(supplierId)) {
        throw new BadRequestException('Invalid supplierId format');
      }
      filter.supplierId = new Types.ObjectId(supplierId); // 👈 التحويل الصريح ده هو اللي هيمنع الـ 500
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
      this.purchaseInvoiceModel
        .find(filter)
        .populate('items.productId', 'name code')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.purchaseInvoiceModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── جلب فاتورة واحدة بالـ ID التفصيلي ─────────────────────────────────────
  async findInvoiceById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Invoice ID format');
    }

    const invoice = await this.purchaseInvoiceModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .populate(
        'items.productId',
        'name code purchasePrice cartonPrice piecesPerCarton',
      )
      .populate('createdBy', 'name email')
      .lean()
      .exec();

    if (!invoice) {
      throw new NotFoundException(
        `Active Purchase Invoice with ID "${id}" not found`,
      );
    }

    return invoice;
  }

  // ─── حذف الفاتورة (Soft Delete) ──────────────────────────────────────────
  async deleteInvoice(id: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Invoice ID format');
    }

    const invoice = await this.purchaseInvoiceModel.findOne({
      _id: new Types.ObjectId(id),
      isActive: true,
    });
    if (!invoice) {
      throw new NotFoundException(`Purchase Invoice with ID "${id}" not found`);
    }

    invoice.isActive = false;
    await invoice.save();

    return {
      message: `Purchase Invoice "${invoice.invoiceNumber}" deactivated successfully`,
    };
  }
}

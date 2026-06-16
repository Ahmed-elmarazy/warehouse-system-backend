// 📄 src/sales-invoices/sales-invoices.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SalesInvoice,
  SalesInvoiceDocument,
  PaymentType,
} from './schemas/sales-invoice.schema';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { SalesInvoiceQueryDto } from './dto/sales-invoice-query.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { CustomersService } from '../customers/customers.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SalesInvoicesService {
  constructor(
    @InjectModel(SalesInvoice.name)
    private readonly salesInvoiceModel: Model<SalesInvoiceDocument>,
    private readonly eventEmitter: EventEmitter2,

    @InjectModel('Product')
    private readonly productModel: Model<any>,

    private readonly stockMovementsService: StockMovementsService,
    private readonly customersService: CustomersService,
  ) {}

  // ─── إنشاء الفاتورة، خصم المخزن، وتحديث الديون ───────────────────────────
  async createInvoice(
    dto: CreateSalesInvoiceDto,
    userId: string,
  ): Promise<SalesInvoiceDocument> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'Sales invoice must contain at least one item.',
      );
    }

    // 1. التأكد من وجود العميل أولاً وصلاحيته
    const customer = await this.customersService.findById(dto.customerId);

    const invoiceNumber = `INV-SALES-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let calculatedTotalAmount = 0;
    const processedItems = [];

    // 2. فحص البضاعة والمخازن والأسعار بدقة
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
          `Product with ID "${item.productId}" not found.`,
        );
      }

      // 💡 الحسبة الذكية: تحويل الكمية لقطع فعلية لو مبيوعة بالكرتونة
      const actualPieces =
        item.unitType === 'CARTON'
          ? item.quantity * (product.piecesPerCarton || 1)
          : item.quantity;

      // 🚨 قانون المخزن الصارم: منع المخزن السالب بناءً على القطع الفعلية!
      if (product.quantityInPieces < actualPieces) {
        throw new BadRequestException(
          `Inadequate stock for "${product.name}"! Available: ${product.quantityInPieces} pcs, requested: ${actualPieces} pcs (${item.quantity} ${item.unitType}).`,
        );
      }

      // حساب إجمالي السطر (الكمية * السعر) - خصم الصنف (الكمية هنا تفضل زي ما هي عشان السعر بيبقى جاي للوحدة المبعوثة)
      const itemTotal = item.quantity * item.price - item.discount;
      if (itemTotal < 0) {
        throw new BadRequestException(
          `Discount for product "${product.name}" cannot exceed its total price.`,
        );
      }

      calculatedTotalAmount += itemTotal;

      // حساب التكلفة الحقيقية للصنف الفردي (COGS) بناءً على سعر الشراء التخزيني للقطع
      const pieceCost = product.purchasePrice || 0;
      const actualItemCost = actualPieces * pieceCost;

      // خصم رصيد المنتج الفعلي في الداتابيز بالقطع
      product.quantityInPieces -= actualPieces;
      await product.save();

      // حفظ الداتا للطباعة مع حقن الـ الكواليس (totalPieces & totalCost)
      processedItems.push({
        productId: product._id,
        quantity: item.quantity, // بتفضل 1 كرتونة زي ما هي للطباعة والفرونت
        unitType: item.unitType, // بتفضل CARTON للطباعة والفرونت
        price: item.price,
        discount: item.discount,
        total: itemTotal,
        totalPieces: actualPieces, // 👈 تتحقن وتتحفظ جوه السجل للتقارير والأرباح
        totalCost: actualItemCost, // 👈 تتحقن وتتحفظ عشان حساب الـ COGS
      });
    }

    // 3. تطبيق الحسابات والخصم الكلي للفاتورة
    const finalAmount = calculatedTotalAmount - dto.discount;
    if (finalAmount < 0) {
      throw new BadRequestException(
        'Main invoice discount cannot exceed the final total amount.',
      );
    }

    // 4. ضبط حسابات الدفع والمديونية بناءً على نوع العملية بالملي
    let paidAmount = dto.paidAmount;
    let remainingAmount = 0;

    if (dto.paymentType === PaymentType.CASH) {
      paidAmount = finalAmount; // الكاش بيقفل الحساب بالكامل فوراً
      remainingAmount = 0;
    } else if (dto.paymentType === PaymentType.CREDIT) {
      paidAmount = 0; // الآجل بالكامل مدفوعه صفر
      remainingAmount = finalAmount;
    } else if (dto.paymentType === PaymentType.PARTIAL) {
      if (paidAmount >= finalAmount) {
        throw new BadRequestException(
          'Paid amount for partial invoice must be less than final amount. Use CASH instead.',
        );
      }
      remainingAmount = finalAmount - paidAmount;
    }

    // 5. حفظ الفاتورة في قاعدة البيانات
    const newInvoice = new this.salesInvoiceModel({
      invoiceNumber,
      customerId: customer._id,
      items: processedItems,
      totalAmount: calculatedTotalAmount,
      discount: dto.discount,
      finalAmount,
      paidAmount,
      remainingAmount,
      paymentType: dto.paymentType,
      createdBy: new Types.ObjectId(userId),
    });

    const savedInvoice = await newInvoice.save();

    // ─── 🔔 إطلاق حدث إنشاء فاتورة البيع تلقائياً لنظام التنبيهات ───
    try {
      const invoiceData = savedInvoice as any;
      const customerData = customer as any;
      this.eventEmitter.emit('sales.invoice.created', {
        id: invoiceData._id.toString(),
        invoiceNumber: invoiceData.invoiceNumber,
        finalAmount: invoiceData.finalAmount,
        customerName:
          customerData?.fullName || customerData?.name || 'عميل نقدي', // 👈 جلب الاسم الفعلي بأمان
      });
    } catch (error) {
      console.error('Failed to emit sales invoice notification event:', error);
    }

    // 6. استدعاء محرك المخزن آلياً لخصم البضاعة بالقطع الفعلية (actualPieces)
    for (const pItem of processedItems) {
      await this.stockMovementsService.createMovement(
        {
          productId: pItem.productId.toString(),
          type: 'SALE',
          referenceType: 'SALES_INVOICE',
          referenceId: invoiceNumber,
          quantityChanged: -pItem.totalPieces, // 👈 التعديل هنا: الخصم بالقطع الفعلية التراكمية في كرت الهوية للمخزن
          notes: `Automated stock deduction for invoice ${invoiceNumber} (${pItem.quantity} ${pItem.unitType})`,
        },
        userId,
      );
    }

    // 7. استدعاء المحرك المالي للعملاء لتحديث الديون آلياً إذا كان هناك متبقي
    if (remainingAmount > 0) {
      await this.customersService.updateCustomerDebt(
        customer._id.toString(),
        remainingAmount,
      );
    }

    return savedInvoice;
  }

  // ─── جلب الفواتير بالـ Pagination والبحث ────────────────────────────────
  async findAllInvoices(query: SalesInvoiceQueryDto): Promise<any> {
    const {
      page = 1,
      limit = 10,
      search,
      customerId,
      paymentType,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { isActive: true };

    if (search) {
      filter.invoiceNumber = { $regex: search.trim(), $options: 'i' };
    }
    if (customerId && Types.ObjectId.isValid(customerId)) {
      filter.customerId = new Types.ObjectId(customerId);
    }
    if (paymentType) {
      filter.paymentType = paymentType;
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
      this.salesInvoiceModel
        .find(filter)
        .populate('customerId', 'name customerCode phone')
        .populate({
          path: 'items.productId',
          select: 'name code price piecesPerCarton purchasePrice', // 💡 أضفنا الـ purchasePrice للاحتياط
          options: { strictPopulate: false },
        })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.salesInvoiceModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── جلب تفاصيل فاتورة واحدة ───────────────────────────────────────────
  async findInvoiceById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Invoice ID format');
    }

    const invoice = await this.salesInvoiceModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .populate('customerId', 'name customerCode phone address')
      .populate('items.productId', 'name code piecesPerCarton purchasePrice')
      .populate('createdBy', 'name email')
      .lean()
      .exec();

    if (!invoice) {
      throw new NotFoundException(`Sales Invoice with ID "${id}" not found.`);
    }
    return invoice;
  }

  // ─── الحذف المؤقت لفاتورة (Soft Delete) ──────────────────────────────────
  async deleteInvoice(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Invoice ID format');
    }
    const result = await this.salesInvoiceModel
      .findByIdAndUpdate(id, { $set: { isActive: false } })
      .exec();

    if (!result) {
      throw new NotFoundException(`Invoice with ID "${id}" not found.`);
    }
  }
}

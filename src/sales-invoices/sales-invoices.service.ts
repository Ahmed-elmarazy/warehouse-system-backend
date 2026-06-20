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
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class SalesInvoicesService {
  constructor(
    @InjectModel(SalesInvoice.name)
    private readonly salesInvoiceModel: Model<SalesInvoiceDocument>,
    private readonly eventEmitter: EventEmitter2,

    @InjectModel('Product')
    private readonly productModel: Model<any>,

    @InjectConnection() private readonly connection: Connection,
    private readonly stockMovementsService: StockMovementsService,
    private readonly customersService: CustomersService,
  ) {}

  // ─── 1️⃣ إنشاء فاتورة بيع جديدة ───────────────────────────────────────────
  async createInvoice(
    dto: CreateSalesInvoiceDto,
    userId: string,
  ): Promise<SalesInvoiceDocument> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'Sales invoice must contain at least one item.',
      );
    }

    // 🚀 بدء السيسشن والـ Transaction الفعلي للمونجو دي بي
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. جلب بيانات العميل وصلاحيته
      const customer = await this.customersService.findById(dto.customerId);

      const invoiceNumber = `INV-SALES-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      let calculatedTotalAmount = 0;
      const processedItems = [];

      // 2. فحص البضاعة والمخازن بدقة بالتزامن مع الـ session
      for (const item of dto.items) {
        if (!Types.ObjectId.isValid(item.productId)) {
          throw new BadRequestException(
            `Invalid Product ID: ${item.productId}`,
          );
        }

        const product = await this.productModel
          .findOne({
            _id: new Types.ObjectId(item.productId),
            isActive: true,
          })
          .session(session); // 👈 فحص المنتج وتجميده جوة الـ session حتي انتهاء العملية

        if (!product) {
          throw new NotFoundException(
            `Product with ID "${item.productId}" not found.`,
          );
        }

        // الحسبة الذكية للكرتونة والقطع
        const actualPieces =
          item.unitType === 'CARTON'
            ? item.quantity * (product.piecesPerCarton || 1)
            : item.quantity;

        // صمام الأمان الصارم للمخزن السالب
        if (product.quantityInPieces < actualPieces) {
          throw new BadRequestException(
            `Inadequate stock for "${product.name}"! Available: ${product.quantityInPieces} pcs, requested: ${actualPieces} pcs.`,
          );
        }

        const itemTotal = item.quantity * item.price - item.discount;
        if (itemTotal < 0) {
          throw new BadRequestException(
            `Discount for product "${product.name}" cannot exceed its total price.`,
          );
        }

        calculatedTotalAmount += itemTotal;

        const pieceCost = product.purchasePrice || 0;
        const actualItemCost = actualPieces * pieceCost;

        processedItems.push({
          productId: product._id,
          quantity: item.quantity,
          unitType: item.unitType,
          price: item.price,
          discount: item.discount,
          total: itemTotal,
          totalPieces: actualPieces,
          totalCost: actualItemCost,
        });
      }

      // 3. تطبيق الخصم الكلي للفاتورة
      const finalAmount = calculatedTotalAmount - dto.discount;
      if (finalAmount < 0) {
        throw new BadRequestException(
          'Main invoice discount cannot exceed the final total amount.',
        );
      }

      // 4. ضبط حسابات الدفع والمديونية
      let paidAmount = dto.paidAmount;
      let remainingAmount = 0;

      if (dto.paymentType === PaymentType.CASH) {
        paidAmount = finalAmount;
        remainingAmount = 0;
      } else if (dto.paymentType === PaymentType.CREDIT) {
        paidAmount = 0;
        remainingAmount = finalAmount;
      } else if (dto.paymentType === PaymentType.PARTIAL) {
        if (paidAmount >= finalAmount) {
          throw new BadRequestException(
            'Paid amount for partial invoice must be less than final amount. Use CASH instead.',
          );
        }
        remainingAmount = finalAmount - paidAmount;
      }

      // 5. حفظ الفاتورة في قاعدة البيانات مع تمرير الـ session صراحة
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

      const savedInvoice = await newInvoice.save({ session });

      // 6. استدعاء محرك المخزن آلياً وتمرير الـ session له ليقوم بالخصم والتسجيل معاً
      for (const pItem of processedItems) {
        await this.stockMovementsService.createMovement(
          {
            productId: pItem.productId.toString(),
            type: 'SALE',
            referenceType: 'SALES_INVOICE',
            referenceId: invoiceNumber,
            quantityChanged: pItem.totalPieces,
            notes: `Automated stock deduction for invoice ${invoiceNumber}`,
          },
          userId,
          session,
        );
      }

      // 7. استدعاء المحرك المالي للعملاء لتحديث الديون آلياً مع تمرير الـ session
      if (remainingAmount > 0) {
        await this.customersService.updateCustomerDebt(
          customer._id.toString(),
          remainingAmount,
          session,
        );
      }

      // 🎯 نجحت كل الخطوات بدون أي Exception؟ ثبت البيانات فوراً!
      await session.commitTransaction();
      session.endSession();

      // ─── 🔔 إطلاق الإشعارات والأحداث المطبوعة ───
      try {
        this.eventEmitter.emit('sales.invoice.created', {
          id: savedInvoice._id.toString(),
          invoiceNumber: savedInvoice.invoiceNumber,
          finalAmount: savedInvoice.finalAmount,
          customerName: customer?.name || 'عميل نقدي',
        });
      } catch (error) {
        console.error(
          'Failed to emit sales invoice notification event:',
          error,
        );
      }

      return savedInvoice;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (!session.hasEnded) {
        session.endSession();
      }
    }
  }

  // ─── 2️⃣ تحديث فاتورة بيع قائمة مع عكس الأثر المخزني والمالي بالكامل ───────────
  // ─── 2️⃣ تحديث فاتورة بيع قائمة مع عكس الأثر المخزني والمالي بالكامل ───────────
  async updateInvoice(
    id: string,
    dto: CreateSalesInvoiceDto,
    userId: string,
  ): Promise<SalesInvoiceDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Invoice ID format');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'Sales invoice must contain at least one item.',
      );
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. جلب الفاتورة القديمة والتأكد من وجودها ونشاطها
      const oldInvoice = await this.salesInvoiceModel
        .findOne({ _id: new Types.ObjectId(id), isActive: true })
        .session(session)
        .exec();

      if (!oldInvoice) {
        throw new NotFoundException(
          `Sales Invoice with ID "${id}" not found or inactive.`,
        );
      }

      // 💾 حفظ قائمة الـ Product IDs الموجودة أصلاً في الفاتورة القديمة لتسهيل المقارنة والـ Bypass
      const oldInvoiceProductIds = oldInvoice.items.map((item) =>
        item.productId.toString(),
      );

      // 2. ⏪ [عكس تأثير الفاتورة القديمة] ⏪
      // أ) إعادة كميات البضائع السابقة إلى المخزن (حركة تزويد مخزن)
      for (const oldItem of oldInvoice.items) {
        await this.stockMovementsService.createMovement(
          {
            productId: oldItem.productId.toString(),
            type: 'PURCHASE', // حركة عكسية (وارد) لإعادة توازن كارت الصنف والمخزن
            referenceType: 'SALES_INVOICE',
            referenceId: oldInvoice.invoiceNumber,
            quantityChanged: oldItem.totalPieces,
            notes: `Reverting old stock for invoice update ${oldInvoice.invoiceNumber}`,
          },
          userId,
          session,
        );
      }

      // ب) إنقاص مديونية العميل القديم بقيمة المتبقي السابق للفاتورة
      if (oldInvoice.remainingAmount > 0) {
        await this.customersService.updateCustomerDebt(
          oldInvoice.customerId.toString(),
          -oldInvoice.remainingAmount, // تمرير القيمة بالسالب للتخفيض المالي
          session,
        );
      }

      // 3. ⏩ [تطبيق تأثير الفاتورة الجديدة] ⏩
      const customer = await this.customersService.findById(dto.customerId);
      let calculatedTotalAmount = 0;
      const processedItems = [];

      // فحص وتجهيز الأصناف الجديدة مع التحقق الصارم من المخزن بعد الـ Revert
      for (const item of dto.items) {
        if (!Types.ObjectId.isValid(item.productId)) {
          throw new BadRequestException(
            `Invalid Product ID: ${item.productId}`,
          );
        }

        // 🧠 الحل الذكي: لو المنتج موجود بالفاتورة القديمة، نعمل Bypass لشرط الـ isActive
        const isExistingProductInInvoice = oldInvoiceProductIds.includes(
          item.productId.toString(),
        );

        const productFilter: Record<string, any> = {
          _id: new Types.ObjectId(item.productId),
        };

        // نطبق شرط النشاط فقط لو المنتج جديد ولم يكن جزءاً من الفاتورة من قبل
        if (!isExistingProductInInvoice) {
          productFilter.isActive = true;
        }

        const product = await this.productModel
          .findOne(productFilter)
          .session(session);

        if (!product) {
          throw new NotFoundException(
            isExistingProductInInvoice
              ? `Product with ID "${item.productId}" was found in the database but might have been hard-deleted.`
              : `Product with ID "${item.productId}" not found or is currently Inactive.`,
          );
        }

        const actualPieces =
          item.unitType === 'CARTON'
            ? item.quantity * (product.piecesPerCarton || 1)
            : item.quantity;

        // صمام الأمان الصارم للمخزن السالب على الحسبة الجديدة
        if (product.quantityInPieces < actualPieces) {
          throw new BadRequestException(
            `Inadequate stock for "${product.name}"! Available after revert: ${product.quantityInPieces} pcs, requested: ${actualPieces} pcs.`,
          );
        }

        const itemTotal = item.quantity * item.price - item.discount;
        if (itemTotal < 0) {
          throw new BadRequestException(
            `Discount for product "${product.name}" cannot exceed its total price.`,
          );
        }

        calculatedTotalAmount += itemTotal;
        const pieceCost = product.purchasePrice || 0;
        const actualItemCost = actualPieces * pieceCost;

        processedItems.push({
          productId: product._id,
          quantity: item.quantity,
          unitType: item.unitType,
          price: item.price,
          discount: item.discount,
          total: itemTotal,
          totalPieces: actualPieces,
          totalCost: actualItemCost,
        });
      }

      // تطبيق الخصم الكلي الجديد
      const finalAmount = calculatedTotalAmount - dto.discount;
      if (finalAmount < 0) {
        throw new BadRequestException(
          'Main invoice discount cannot exceed the final total amount.',
        );
      }

      // ضبط حسابات الدفع والمديونية الجديدة
      let paidAmount = dto.paidAmount;
      let remainingAmount = 0;

      if (dto.paymentType === PaymentType.CASH) {
        paidAmount = finalAmount;
        remainingAmount = 0;
      } else if (dto.paymentType === PaymentType.CREDIT) {
        paidAmount = 0;
        remainingAmount = finalAmount;
      } else if (dto.paymentType === PaymentType.PARTIAL) {
        if (paidAmount >= finalAmount) {
          throw new BadRequestException(
            'Paid amount for partial invoice must be less than final amount. Use CASH instead.',
          );
        }
        remainingAmount = finalAmount - paidAmount;
      }

      // 4. 📉 خصم الكميات الجديدة من المخزن وتسجيل حركة الـ SALE المحدثة
      for (const pItem of processedItems) {
        await this.stockMovementsService.createMovement(
          {
            productId: pItem.productId.toString(),
            type: 'SALE',
            referenceType: 'SALES_INVOICE',
            referenceId: oldInvoice.invoiceNumber,
            quantityChanged: pItem.totalPieces,
            notes: `Automated stock deduction for updated invoice ${oldInvoice.invoiceNumber}`,
          },
          userId,
          session,
        );
      }

      // 5. 📈 إضافة المديونية الجديدة لحساب العميل الحالي
      if (remainingAmount > 0) {
        await this.customersService.updateCustomerDebt(
          customer._id.toString(),
          remainingAmount,
          session,
        );
      }

      // 6. 📝 تحديث مستند الفاتورة نفسه وحفظ التعديلات
      oldInvoice.customerId = customer._id as any;
      oldInvoice.items = processedItems as any;
      oldInvoice.totalAmount = calculatedTotalAmount;
      oldInvoice.discount = dto.discount;
      oldInvoice.finalAmount = finalAmount;
      oldInvoice.paidAmount = paidAmount;
      oldInvoice.remainingAmount = remainingAmount;
      oldInvoice.paymentType = dto.paymentType;

      // ✨ تم معالجة وتفادي التنبيه والخط الأحمر الخاص بـ TypeScript بشكل سليم وآمن تماماً
      oldInvoice.set('updatedBy', new Types.ObjectId(userId));

      const updatedInvoice = await oldInvoice.save({ session });

      await session.commitTransaction();
      session.endSession();

      // إطلاق حدث التحديث لإشعار الـ Sockets والأنظمة الخارجية للـ Real-time
      try {
        this.eventEmitter.emit('sales.invoice.updated', {
          id: updatedInvoice._id.toString(),
          invoiceNumber: updatedInvoice.invoiceNumber,
          finalAmount: updatedInvoice.finalAmount,
          customerName: customer?.name || 'عميل نقدي',
        });
      } catch (error) {
        console.error('Failed to emit sales invoice update event:', error);
      }

      return updatedInvoice;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (!session.hasEnded) {
        session.endSession();
      }
    }
  }

  // ─── 3️⃣ جلب الفواتير بالـ Pagination والبحث ────────────────────────────────
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
          select: 'name code price piecesPerCarton purchasePrice',
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

  // ─── 4️⃣ جلب تفاصيل فاتورة واحدة ───────────────────────────────────────────
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

  // ─── 5️⃣ الحذف المؤقت لفاتورة (Soft Delete) ──────────────────────────────────
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

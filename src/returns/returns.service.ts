// 📄 src/returns/returns.service.ts

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import {
  CustomerReturn,
  CustomerReturnDocument,
} from './schemas/customer-return.schema';
import {
  SupplierReturn,
  SupplierReturnDocument,
} from './schemas/supplier-return.schema';
import { CreateCustomerReturnDto } from './dto/create-customer-return.dto';
import { CreateSupplierReturnDto } from './dto/create-supplier-return.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { CustomersService } from '../customers/customers.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SuppliersService } from '../suppliers/suppliers.service';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectModel(CustomerReturn.name)
    private readonly customerReturnModel: Model<CustomerReturnDocument>,
    @InjectModel(SupplierReturn.name)
    private readonly supplierReturnModel: Model<SupplierReturnDocument>,
    @InjectModel('Product') private readonly productModel: Model<any>,
    @InjectModel('SalesInvoice') private readonly salesInvoiceModel: Model<any>,
    @InjectModel('Supplier') private readonly supplierModel: Model<any>,

    @InjectConnection() private readonly connection: Connection,
    private readonly stockMovementsService: StockMovementsService,
    private readonly customersService: CustomersService,
    private readonly suppliersService: SuppliersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── 1️⃣ مرتجع عميل (كرتونة / قطعة + كاش / آجل) ───────────────────
  async createCustomerReturn(
    dto: CreateCustomerReturnDto,
    userId: string,
  ): Promise<CustomerReturnDocument> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const customer = await this.customersService.findById(dto.customerId);
      if (!customer) throw new NotFoundException('Customer not found.');

      const returnNumber = `RET-CUST-${Date.now()}`;
      let totalReturnAmount = 0;
      let totalReturnCost = 0;
      const processedItems: any[] = [];

      // ─── التحقق من الفاتورة لو مربوطة ───
      let invoice: any = null;
      if (dto.invoiceId) {
        invoice = await this.salesInvoiceModel
          .findOne({ _id: new Types.ObjectId(dto.invoiceId), isActive: true })
          .session(session)
          .lean()
          .exec();
        if (!invoice)
          throw new NotFoundException('Linked Sales Invoice not found.');
      }

      // ─── معالجة كل صنف مرتجع من العميل ───
      for (const item of dto.items) {
        const product = await this.productModel
          .findOne({ _id: new Types.ObjectId(item.productId), isActive: true })
          .session(session);
        if (!product)
          throw new NotFoundException(`Product ${item.productId} not found.`);

        // 💡 الحسبة الذكية: تحويل الكمية المرتجعة لقطع فعلية بناءً على نوع الوحدة المرتجعة (CARTON أو PIECE)
        const actualPiecesReturned =
          item.unitType === 'CARTON'
            ? item.quantity * (product.piecesPerCarton || 1)
            : item.quantity;

        // التحقق القياسي في حالة الارتجاع بناءً على فاتورة بيع معينة
        if (invoice) {
          if (!invoice.items || !Array.isArray(invoice.items)) {
            throw new BadRequestException(
              `Invoice ${invoice.invoiceNumber} does not contain valid items.`,
            );
          }
          const soldItem = invoice.items.find(
            (i: any) =>
              i.productId && i.productId.toString() === item.productId,
          );
          if (!soldItem) {
            throw new BadRequestException(
              `Product "${product.name}" was not sold in this invoice.`,
            );
          }

          // جلب القطع الفعلية المباعة بالفاتورة لحماية المقارنة
          const actualPiecesSold =
            soldItem.totalPieces ??
            (soldItem.unitType === 'CARTON'
              ? soldItem.quantity * (product.piecesPerCarton || 1)
              : soldItem.quantity);

          if (actualPiecesReturned > actualPiecesSold) {
            throw new BadRequestException(
              `Returned quantity for "${product.name}" (${item.quantity} ${item.unitType} = ${actualPiecesReturned} pcs) exceeds sold quantity (${soldItem.quantity} ${soldItem.unitType || ''} = ${actualPiecesSold} pcs).`,
            );
          }
        }

        // حساب إجمالي السعر للصنف المرتجع (الكمية المدخلة كرتونة/قطعة * سعرها المرتجع)
        const itemSaleTotal = item.quantity * item.price;

        // حساب التكلفة الحقيقية (COGS) المستردة للمخزن بناءً على القطع الفعلية وسعر تكلفة القطعة الواحدة
        const purchasePrice = product.purchasePrice ?? item.purchasePrice ?? 0;
        const itemCostTotal = actualPiecesReturned * purchasePrice;

        totalReturnAmount += itemSaleTotal;
        totalReturnCost += itemCostTotal;

        processedItems.push({
          productId: product._id,
          quantity: item.quantity, // الكمية بالوحدة المختارة (مثال: 2 كرتونة)
          unitType: item.unitType, // نوع الوحدة (CARTON أو PIECE)
          price: item.price,
          total: itemSaleTotal,
          purchasePrice,
          totalPieces: actualPiecesReturned, // القطع التراكمية للتقارير وحركات المخازن
          totalCost: itemCostTotal,
        });

        // إعادة الكمية الفعلية بالقطع إلى المخزون
        product.quantityInPieces += actualPiecesReturned;
        await product.save({ session });
      }

      const lostProfit = totalReturnAmount - totalReturnCost;

      // ─── حفظ سجل المرتجع ───
      const newReturn = new this.customerReturnModel({
        returnNumber,
        customerId: new Types.ObjectId(dto.customerId),
        invoiceId: dto.invoiceId ? new Types.ObjectId(dto.invoiceId) : null,
        items: processedItems,
        totalAmount: totalReturnAmount,
        totalCost: totalReturnCost,
        lostProfit,
        returnType: dto.returnType,
        reason: dto.reason,
        createdBy: userId ? new Types.ObjectId(userId) : null,
      });
      const savedReturn = await newReturn.save({ session });

      // ─── تحديث الفاتورة المرتبطة ماليًا (إن وجدت) ───
      if (invoice && dto.invoiceId) {
        if (dto.returnType === 'CASH') {
          const updatedFinalAmount = Math.max(
            0,
            (invoice.finalAmount || 0) - totalReturnAmount,
          );
          const updatedPaidAmount = Math.max(
            0,
            (invoice.paidAmount || 0) - totalReturnAmount,
          );
          const updatedRemainingAmount = Math.max(
            0,
            updatedFinalAmount - updatedPaidAmount,
          );

          await this.salesInvoiceModel.findByIdAndUpdate(
            dto.invoiceId,
            {
              $set: {
                finalAmount: updatedFinalAmount,
                paidAmount: updatedPaidAmount,
                remainingAmount: updatedRemainingAmount,
              },
            },
            { session },
          );
        } else {
          const updatedFinalAmount = Math.max(
            0,
            (invoice.finalAmount || 0) - totalReturnAmount,
          );
          const updatedRemainingAmount = Math.max(
            0,
            (invoice.remainingAmount || 0) - totalReturnAmount,
          );

          await this.salesInvoiceModel.findByIdAndUpdate(
            dto.invoiceId,
            {
              $set: {
                finalAmount: updatedFinalAmount,
                remainingAmount: updatedRemainingAmount,
              },
            },
            { session },
          );
        }
      }

      // ─── تحديث مديونية العميل ماليًا لو نوع المرتجع CREDIT ───
      if (dto.returnType === 'CREDIT') {
        await this.customersService.updateCustomerDebt(
          customer._id.toString(),
          -totalReturnAmount,
          session, // تمرير الـ session لضمان الـ ACID Compliance
        );
      }

      await session.commitTransaction();
      session.endSession();

      // ─── إرسال الأحداث والـ Events (خارج نطاق الـ Transaction) ───
      try {
        this.eventEmitter.emit('customer.return.created', {
          id: savedReturn._id.toString(),
          returnNumber,
          returnType: dto.returnType,
          totalReturnAmount,
          totalReturnCost,
          lostProfit,
          customerName: customer?.name || 'عميل مجهول',
          reason: dto.reason,
        });
      } catch (err) {
        console.error('Failed to emit customer return event:', err);
      }

      // ─── تسجيل حركات المخزن بالقطع الفعلية المحسوبة ───
      for (const pItem of processedItems) {
        await this.stockMovementsService.createMovement(
          {
            productId: pItem.productId.toString(),
            type: 'CUSTOMER_RETURN' as any,
            referenceType: 'RETURN',
            referenceId: returnNumber,
            quantityChanged: pItem.totalPieces, // زيادة المخزن بالقطع الفعلية المستلمة
            notes: `[${dto.returnType}] Customer return ${returnNumber}. (${pItem.quantity} ${pItem.unitType}). Reason: ${dto.reason}`,
          },
          userId,
        );
      }

      return savedReturn;
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      throw error;
    } finally {
      if (!session.hasEnded) session.endSession();
    }
  }

  // ─── 2️⃣ مرتجع مورد (كرتونة / قطعة + حماية من المخزن السالب) ───────────────────
  async createSupplierReturn(
    dto: CreateSupplierReturnDto,
    userId: string,
  ): Promise<SupplierReturnDocument> {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const supplier = await this.supplierModel
        .findOne({ _id: new Types.ObjectId(dto.supplierId), isActive: true })
        .session(session);
      if (!supplier) throw new NotFoundException('Supplier not found.');

      const returnNumber = `RET-SUPP-${Date.now()}`;
      let totalReturnAmount = 0;
      const processedItems: any[] = [];

      // ─── معالجة كل صنف مرتجع إلى المورد ───
      for (const item of dto.items) {
        const product = await this.productModel
          .findOne({ _id: new Types.ObjectId(item.productId), isActive: true })
          .session(session);
        if (!product)
          throw new NotFoundException(`Product ${item.productId} not found.`);

        // 💡 الحسبة الذكية للمورد: تحويل الكمية المرجعة (كرتونة/قطعة) إلى قطع فعلية مخزنية
        const actualPiecesReturned =
          item.unitType === 'CARTON'
            ? item.quantity * (product.piecesPerCarton || 1)
            : item.quantity;

        // قانون المخزن الصارم: منع إرجاع بضاعة للمورد بكمية أكبر من الرصيد الحالي بالقطع داخل المخزن
        if (product.quantityInPieces < actualPiecesReturned) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${product.quantityInPieces} pcs, requested return: ${actualPiecesReturned} pcs (${item.quantity} ${item.unitType}).`,
          );
        }

        // حساب إجمالي التكلفة المستردة من المورد لهذا الصنف
        const itemTotal = item.quantity * item.price;
        totalReturnAmount += itemTotal;

        processedItems.push({
          productId: product._id,
          quantity: item.quantity, // الكمية المدخلة (مثال: 5 كراتين)
          unitType: item.unitType, // الوحدة (CARTON أو PIECE)
          price: item.price,
          total: itemTotal,
          totalPieces: actualPiecesReturned, // القطع الفعلية الخارجة من المخزن للمورد
        });

        // خصم الكمية الفعلية بالقطع من رصيد المنتج بالخزنة والمخزن
        product.quantityInPieces -= actualPiecesReturned;
        await product.save({ session });
      }

      // ─── حفظ سجل مرتجع المورد ───
      const newReturn = new this.supplierReturnModel({
        returnNumber,
        supplierId: new Types.ObjectId(dto.supplierId),
        items: processedItems,
        reason: dto.reason,
        totalAmount: totalReturnAmount,
        createdBy: userId ? new Types.ObjectId(userId) : null,
      });
      const savedReturn = await newReturn.save({ session });

      // ─── تحديث مديونية وحساب المورد المالي بالسالب (خصم من حسابه المالي) ───
      await this.suppliersService.updateSupplierBalance(
        dto.supplierId,
        -totalReturnAmount,
        session, // لضمان العزل المالي التام والـ ACID Compliance
      );

      await session.commitTransaction();
      session.endSession();

      // ─── إرسال الأحداث الإشعارية (خارج الـ Transaction) ───
      try {
        this.eventEmitter.emit('supplier.return.created', {
          id: savedReturn._id.toString(),
          returnNumber,
          totalReturnAmount,
          supplierName: supplier.name,
        });
      } catch (err) {
        console.error('Failed to emit supplier return event:', err);
      }

      // ─── تسجيل حركات المخزن بالسالب (خروج بضاعة للمورد) ───
      for (const pItem of processedItems) {
        await this.stockMovementsService.createMovement(
          {
            productId: pItem.productId.toString(),
            type: 'SUPPLIER_RETURN' as any,
            referenceType: 'RETURN',
            referenceId: returnNumber,
            quantityChanged: -pItem.totalPieces, // إشارة سالبة لخصمها من كارت حركة المخزن
            notes: `Supplier return ${returnNumber}. (${pItem.quantity} ${pItem.unitType}). Reason: ${dto.reason}`,
          },
          userId,
        );
      }

      return savedReturn;
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      throw error;
    } finally {
      if (!session.hasEnded) session.endSession();
    }
  }

  // ─── 3️⃣ دوال الجلب والعرض (Queries) ──────────────────────────────────────────
  async getCustomerReturns(): Promise<CustomerReturn[]> {
    return this.customerReturnModel
      .find({ isActive: true })
      .populate('customerId', 'name customerCode')
      .populate('items.productId', 'name code')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async getCustomerReturnById(id: string): Promise<CustomerReturn> {
    const rec = await this.customerReturnModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .populate('customerId', 'name customerCode')
      .populate('items.productId', 'name code')
      .lean()
      .exec();
    if (!rec) throw new NotFoundException('Customer Return record not found.');
    return rec;
  }

  async getSupplierReturns(): Promise<SupplierReturn[]> {
    return this.supplierReturnModel
      .find({ isActive: true })
      .populate('supplierId', 'name tradeName')
      .populate('items.productId', 'name code')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async getSupplierReturnById(id: string): Promise<SupplierReturn> {
    const rec = await this.supplierReturnModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .populate('supplierId', 'name tradeName')
      .populate('items.productId', 'name code')
      .lean()
      .exec();
    if (!rec) throw new NotFoundException('Supplier Return record not found.');
    return rec;
  }
}

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
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── 1️⃣ مرتجع عميل (مقفل محاسبياً داخل الـ Transaction) ───────────────────
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

      // ─── معالجة كل صنف مرتجع ───
      for (const item of dto.items) {
        const product = await this.productModel
          .findOne({ _id: new Types.ObjectId(item.productId), isActive: true })
          .session(session);
        if (!product)
          throw new NotFoundException(`Product ${item.productId} not found.`);

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
          if (item.quantity > soldItem.quantity) {
            throw new BadRequestException(
              `Returned quantity for "${product.name}" (${item.quantity}) exceeds sold quantity (${soldItem.quantity}).`,
            );
          }
        }

        const itemSaleTotal = item.quantity * item.price;
        const purchasePrice = product.purchasePrice ?? item.purchasePrice ?? 0;
        const itemCostTotal = item.quantity * purchasePrice;

        totalReturnAmount += itemSaleTotal;
        totalReturnCost += itemCostTotal;

        processedItems.push({
          productId: product._id,
          quantity: item.quantity,
          unitType: item.unitType,
          price: item.price,
          total: itemSaleTotal,
          purchasePrice,
          totalCost: itemCostTotal,
        });

        // إعادة الكمية للمخزون داخل الـ session
        product.quantityInPieces += item.quantity;
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

      // ─── تحديث الفاتورة المرتبطة حسب نوع المرتجع ───
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

      // ─── ✅ التعديل الجوهري: تحديث مديونية العميل داخل الـ session لضمان الـ ACID Compliance ───
      if (dto.returnType === 'CREDIT') {
        await this.customersService.updateCustomerDebt(
          customer._id.toString(),
          -totalReturnAmount,
          session, // تمرير الـ session يمنع الـ Race Condition تماماً
        );
      }

      // تثبيت الحركات المالية والمخزنية معاً
      await session.commitTransaction();
      session.endSession();

      // ─── Events (خارج الـ session) ───
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

      // ─── حركات المخزن (خارج الـ session) ───
      for (const pItem of processedItems) {
        await this.stockMovementsService.createMovement(
          {
            productId: pItem.productId.toString(),
            type: 'CUSTOMER_RETURN' as any,
            referenceType: 'RETURN',
            referenceId: returnNumber,
            quantityChanged: pItem.quantity,
            notes: `[${dto.returnType}] Customer return ${returnNumber}. Reason: ${dto.reason}`,
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

  // ─── 2️⃣ مرتجع مورد ─────────────────────────────────────────────────────────
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

      for (const item of dto.items) {
        const product = await this.productModel
          .findOne({ _id: new Types.ObjectId(item.productId), isActive: true })
          .session(session);
        if (!product)
          throw new NotFoundException(`Product ${item.productId} not found.`);

        if (product.quantityInPieces < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${product.quantityInPieces} pcs.`,
          );
        }

        const itemTotal = item.quantity * item.price;
        totalReturnAmount += itemTotal;

        processedItems.push({
          productId: product._id,
          quantity: item.quantity,
          price: item.price,
          total: itemTotal,
        });

        product.quantityInPieces -= item.quantity;
        await product.save({ session });
      }

      const savedReturn = await new this.supplierReturnModel({
        returnNumber,
        supplierId: supplier._id,
        items: processedItems,
        totalAmount: totalReturnAmount,
        reason: dto.reason,
        createdBy: userId ? new Types.ObjectId(userId) : null,
      }).save({ session });

      const updatedSupplier = await this.supplierModel.findByIdAndUpdate(
        supplier._id,
        { $inc: { balance: -totalReturnAmount } },
        { new: true, session },
      );

      if (!updatedSupplier) {
        throw new NotFoundException(`Failed to update balance for supplier.`);
      }

      await session.commitTransaction();
      session.endSession();

      try {
        this.eventEmitter.emit('supplier.return.created', {
          id: savedReturn._id.toString(),
          returnNumber,
          totalAmount: totalReturnAmount,
          supplierName: supplier?.name || 'مورد مجهول',
          supplierNewBalance: updatedSupplier.balance,
          reason: dto.reason,
        });
      } catch (err) {
        console.error('Failed to emit supplier return event:', err);
      }

      for (const pItem of processedItems) {
        await this.stockMovementsService.createMovement(
          {
            productId: pItem.productId.toString(),
            type: 'SUPPLIER_RETURN' as any,
            referenceType: 'RETURN',
            referenceId: returnNumber,
            quantityChanged: -pItem.quantity,
            notes: `Supplier return ${returnNumber}. Reason: ${dto.reason}`,
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

  // ─── 3️⃣ دوال الجلب ──────────────────────────────────────────────────────────
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

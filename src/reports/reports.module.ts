import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
// 🚀 1. استيراد الموديل والـ Schema بتاعة المرتجعات هنا
import {
  CustomerReturn,
  CustomerReturnSchema,
} from '../returns/schemas/customer-return.schema';

// استيراد بقية الـ Schemas الموجودة عندك في السيستم
import { ProductSchema } from '../products/schemas/product.schema';
import { CustomerSchema } from '../customers/schemas/customer.schema';
import { SupplierSchema } from '../suppliers/schemas/supplier.schema';
import { SalesInvoiceSchema } from '../sales-invoices/schemas/sales-invoice.schema';
import { PurchaseInvoiceSchema } from '../purchase-invoices/schemas/purchase-invoice.schema';
import { StockMovementSchema } from '../stock-movements/schemas/stock-movement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'Customer', schema: CustomerSchema },
      { name: 'Supplier', schema: SupplierSchema },
      { name: 'SalesInvoice', schema: SalesInvoiceSchema },
      { name: 'PurchaseInvoice', schema: PurchaseInvoiceSchema },
      { name: 'StockMovement', schema: StockMovementSchema },
      // 🚀 2. ضيف السطر ده هنا بالظبط عشان NestJS يقدر يقرأ الموديل جوه الـ Service
      { name: CustomerReturn.name, schema: CustomerReturnSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

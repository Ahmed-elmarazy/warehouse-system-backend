import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { Supplier, SupplierSchema } from './schemas/supplier.schema';
import {
  SupplierPayment,
  SupplierPaymentSchema,
} from './schemas/supplier-payment.schema';
import {
  PurchaseInvoice,
  PurchaseInvoiceSchema,
} from '../purchase-invoices/schemas/purchase-invoice.schema';
import {
  SupplierReturn,
  SupplierReturnSchema,
} from '../returns/schemas/supplier-return.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
      { name: SupplierPayment.name, schema: SupplierPaymentSchema },
      { name: PurchaseInvoice.name, schema: PurchaseInvoiceSchema },
      { name: SupplierReturn.name, schema: SupplierReturnSchema },
    ]),
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService], // لتتمكن الـ Modules الأخرى مثل الـ Returns من استخدامه
})
export class SuppliersModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import {
  CustomerReturn,
  CustomerReturnSchema,
} from './schemas/customer-return.schema';
import {
  SupplierReturn,
  SupplierReturnSchema,
} from './schemas/supplier-return.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import {
  SalesInvoice,
  SalesInvoiceSchema,
} from '../sales-invoices/schemas/sales-invoice.schema';
import { Supplier, SupplierSchema } from '../suppliers/schemas/supplier.schema';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { CustomersModule } from '../customers/customers.module';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerReturn.name, schema: CustomerReturnSchema },
      { name: SupplierReturn.name, schema: SupplierReturnSchema },
      { name: 'Product', schema: ProductSchema },
      { name: 'SalesInvoice', schema: SalesInvoiceSchema },
      { name: 'Supplier', schema: SupplierSchema },
    ]),
    StockMovementsModule, // ربط محرك الـ Audit Trail للمخزن
    CustomersModule,
    SuppliersModule, // ربط محرك تعديل الديون المالي للعملاء
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}

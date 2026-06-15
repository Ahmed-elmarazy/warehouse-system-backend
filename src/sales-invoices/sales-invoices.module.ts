import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalesInvoicesController } from './sales-invoices.controller';
import { SalesInvoicesService } from './sales-invoices.service';
import {
  SalesInvoice,
  SalesInvoiceSchema,
} from './schemas/sales-invoice.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SalesInvoice.name, schema: SalesInvoiceSchema },
      { name: 'Product', schema: ProductSchema },
    ]),
    StockMovementsModule, // دمج محرك حركة المخزن
    CustomersModule, // دمج موديول إدارة العملاء والديون
  ],
  controllers: [SalesInvoicesController],
  providers: [SalesInvoicesService],
})
export class SalesInvoicesModule {}

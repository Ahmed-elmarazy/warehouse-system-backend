import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchaseInvoicesController } from './purchase-invoices.controller';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import {
  PurchaseInvoice,
  PurchaseInvoiceSchema,
} from './schemas/purchase-invoice.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';

// 1. استيراد موديول الموردين الجديد هنا ⬇️
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PurchaseInvoice.name, schema: PurchaseInvoiceSchema },
      { name: 'Product', schema: ProductSchema },
    ]),
    StockMovementsModule,
    // 2. ضيف الموديول هنا جوه الـ imports عشان نربطهم ببعض ⬇️
    SuppliersModule,
  ],
  controllers: [PurchaseInvoicesController],
  providers: [PurchaseInvoicesService],
})
export class PurchaseInvoicesModule {}

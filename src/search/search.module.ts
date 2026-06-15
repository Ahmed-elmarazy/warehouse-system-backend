// 📄 src/search/search.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

// استيراد السكيمات اللي السيستم محتاجها للبحث
import { ProductSchema } from '../products/schemas/product.schema'; // تأكد من دقة المسارات دي حسب مشروعك
import { CustomerSchema } from '../customers/schemas/customer.schema';
import { SupplierSchema } from '../suppliers/schemas/supplier.schema';
import { SalesInvoiceSchema } from '../sales-invoices/schemas/sales-invoice.schema';
import { PurchaseInvoiceSchema } from '../purchase-invoices/schemas/purchase-invoice.schema';
import { PaymentSchema } from '../payments/schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'Customer', schema: CustomerSchema },
      { name: 'Supplier', schema: SupplierSchema },
      { name: 'SalesInvoice', schema: SalesInvoiceSchema },
      { name: 'PurchaseInvoice', schema: PurchaseInvoiceSchema },
      { name: 'Payment', schema: PaymentSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}

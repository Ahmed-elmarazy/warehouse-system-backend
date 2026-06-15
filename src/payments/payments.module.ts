import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  SalesInvoice,
  SalesInvoiceSchema,
} from '../sales-invoices/schemas/sales-invoice.schema'; // 👈 استيراد السكيما
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: 'SalesInvoice', schema: SalesInvoiceSchema }, // 👈 حقن الموديل هنا للـ Service
    ]),
    CustomersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

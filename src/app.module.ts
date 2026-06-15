import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { OwnerModule } from './owner/owner.module';
import { MailModule } from './mail/mail.module';
import { EmployeesModule } from './employees/employees.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { PurchaseInvoicesModule } from './purchase-invoices/purchase-invoices.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CustomersModule } from './customers/customers.module';
import { SalesInvoicesModule } from './sales-invoices/sales-invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ReturnsModule } from './returns/returns.module';
import { SearchModule } from './search/search.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ContainersModule } from './containers/containers.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGO_URI');
        if (!uri) throw new Error('MONGO_URI is not defined');
        return {
          uri,
          tls: true,
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          minPoolSize: 0,
          bufferCommands: false,
          heartbeatFrequencyMS: 30000,
        };
      },
    }),
    MailModule,
    OwnerModule,
    AuthModule,
    EmployeesModule,
    CategoriesModule,
    ProductsModule,
    StockMovementsModule,
    PurchaseInvoicesModule,
    SuppliersModule,
    CustomersModule,
    SalesInvoicesModule,
    PaymentsModule,
    ReturnsModule,
    SearchModule,
    ReportsModule,
    NotificationsModule,
    ContainersModule,
    WorkersModule, 
  ],
  controllers: [AppController],
})
export class AppModule {}

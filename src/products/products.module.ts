import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from './schemas/product.schema';

// تأكد من صحة مسارات الـ Schemas القديمة الخاصة بك هنا:
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      // تسجيل موديلات الكاتيجوري والسب كاتيجوري لربط التحقق (Cross-Validation)
      { name: 'Category', schema: CategorySchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService], // لتصديره لأي موديول مستقبلي مثل Stock Movement
})
export class ProductsModule {}

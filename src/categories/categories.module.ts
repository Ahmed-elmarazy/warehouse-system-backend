// 📄 src/categories/categories.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './schemas/category.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema'; // 👈 استيراد اسكيمة المنتج
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: 'Product', schema: ProductSchema }, // 👈 تسجيل الـ ProductModel هنا عشان السيرفس تشوفه
    ]),
    AuthModule,
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService], // exported for Products module
})
export class CategoriesModule {}

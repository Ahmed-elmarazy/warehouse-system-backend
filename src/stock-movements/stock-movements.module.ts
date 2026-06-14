import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';
import {
  StockMovement,
  StockMovementSchema,
} from './schemas/stock-movement.schema';

// تأكد من صحة مسار الـ Product Schema الموجود لديك في المشروع
import { Product, ProductSchema } from '../products/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockMovement.name, schema: StockMovementSchema },
      // حقن كوليكشن المنتجات ليتمكن محرك المخزن من القراءة والتعديل المباشر عليها
      { name: 'Product', schema: ProductSchema },
    ]),
  ],
  controllers: [StockMovementsController],
  providers: [StockMovementsService],
  exports: [StockMovementsService], // ضروري جداً لتصديره لموديولات الفواتير والمرتجعات لاحقاً
})
export class StockMovementsModule {}

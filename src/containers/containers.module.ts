import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContainersService } from './containers.service';
import { ContainersController } from './containers.controller';
import { Container, ContainerSchema } from './schemas/container.schema';

@Module({
  imports: [
    // ربط السكيما بـ Mongoose وتحديد اسم الجدول في الداتا بيز
    MongooseModule.forFeature([
      { name: Container.name, schema: ContainerSchema },
    ]),
  ],
  controllers: [ContainersController],
  providers: [ContainersService],
  exports: [ContainersService], // اختياري: لو حبيت تستدعي السيرفيس دي في موديل تاني مستقبلاً
})
export class ContainersModule {}

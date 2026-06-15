import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Owner, OwnerSchema } from './owner.schema';
import { OwnerService } from './owner.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Owner.name, schema: OwnerSchema }]),
  ],
  providers: [OwnerService],
  exports: [OwnerService],
})
export class OwnerModule {}

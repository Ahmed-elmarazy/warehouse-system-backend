import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';
import { Worker, WorkerSchema } from './schemas/worker.schema';
import { WorkerLog, WorkerLogSchema } from './schemas/worker-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Worker.name, schema: WorkerSchema },
      { name: WorkerLog.name, schema: WorkerLogSchema },
    ]),
  ],
  controllers: [WorkersController],
  providers: [WorkersService],
})
export class WorkersModule {}

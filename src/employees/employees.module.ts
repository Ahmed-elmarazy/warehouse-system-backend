import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from './schemas/employee.schema';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
    ]),
    forwardRef(() => AuthModule), // ← forwardRef هنا
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}

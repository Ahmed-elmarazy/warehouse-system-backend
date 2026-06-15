import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WorkersService } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';

@Controller('workers') // يفضل توحيد الـ prefix لو مشروعك شغال بـ api/v1
@ApiTags('Workers (إدارة العمالة اليومية)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post()
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'إضافة عامل جديد يدوياً بواسطة المالك' })
  async create(@Body() dto: CreateWorkerDto, @Req() req: any) {
    const userId = req.user?._id;
    return this.workersService.create(dto, userId);
  }

  @Get()
  @Roles(Role.OWNER)
  @ApiOperation({
    summary:
      'جلب قائمة العمال مع إمكانية البحث بالاسم والفلترة حسب النشاط/الأرشفة',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'البحث بجزء من اسم العامل',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'حالة العامل: true للنشطين، false للمؤرشفين',
    example: 'true',
  })
  async findAll(
    @Query('search') search: string,
    @Query('isActive') isActive: string,
  ) {
    const activeStatus = isActive === 'false' ? false : true;
    return this.workersService.findAll(search, activeStatus);
  }

  @Put(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'تعديل بيانات عامل أساسية عن طريق الـ ID' })
  async update(@Param('id') id: string, @Body() dto: CreateWorkerDto) {
    return this.workersService.update(id, dto);
  }

  @Put(':id/archive')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'أرشفة العامل أو إعادة تنشيطه' })
  @ApiQuery({
    name: 'isActive',
    required: true,
    description: 'ضع false لنقل العامل للأرشيف، و true لإعادته للنظام',
    example: 'false',
  })
  async archive(@Param('id') id: string, @Query('isActive') isActive: string) {
    const status = isActive === 'true';
    return this.workersService.toggleArchive(id, status);
  }

  @Post(':id/payments')
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'تسجيل دفعة مالية جديدة للعامل (يومية / أسبوعية / شهرية)',
  })
  async addPayment(
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
    @Req() req: any,
  ) {
    const userId = req.user?._id;
    return this.workersService.addPayment(id, dto, userId);
  }

  @Get(':id/statement')
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'جلب كشف الحساب المالي وسجل الدفعات بالكامل لعامل معين',
  })
  async getStatement(@Param('id') id: string) {
    return this.workersService.getWorkerStatement(id);
  }
}

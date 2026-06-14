import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContainersService } from './containers.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import {
  ApiQuery,
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Containers (خاص بصاحب العمل فقط)')
@ApiBearerAuth()
@ApiBearerAuth('access-token')
// عشان يظهر لك قفل التوكين (Authorize) في الـ Swagger
@UseGuards(AuthGuard, RolesGuard)
@Controller('containers')
export class ContainersController {
  constructor(private readonly containersService: ContainersService) {}

  // 1. إنشاء حاوية جديدة
  @Post()
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'إضافة حاوية جديدة نوتة مستقلة' })
  async create(@Body() createContainerDto: CreateContainerDto) {
    return this.containersService.create(createContainerDto);
  }

  // 2. جلب كل الحاويات مع إمكانية البحث الاختياري
  @Get()
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'جلب كل الحاويات مع بحث اختياري برقم الحاوية أو الملاحظات',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'ابحث برقم الحاوية أو الملاحظات (اتركه فارغاً لجلب كل الحاويات الإجمالية)',
  })
  async findAll(@Query('search') search?: string) {
    return this.containersService.findAll(search);
  }

  // 3. جلب حاوية واحدة محددة
  @Get(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'جلب تفاصيل حاوية واحدة بواسطة الـ ID' })
  async findOne(@Param('id') id: string) {
    return this.containersService.findOne(id);
  }

  // 4. تعديل بيانات حاوية أو دفع جزء مالي
  @Patch(':id')
  @Roles(Role.OWNER)
  @ApiOperation({
    summary:
      'تعديل بيانات الحاوية أو دفع جزء مالي (يتم إعادة حساب المتبقي تلقائياً)',
  })
  async update(
    @Param('id') id: string,
    @Body() updateContainerDto: UpdateContainerDto,
  ) {
    return this.containersService.update(id, updateContainerDto);
  }

  // 5. حذف حاوية نهائياً
  @Delete(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'حذف حاوية من سجل التذكيرات نهائياً' })
  async remove(@Param('id') id: string) {
    return this.containersService.remove(id);
  }
}

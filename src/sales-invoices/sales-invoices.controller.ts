import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SalesInvoicesService } from './sales-invoices.service';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { SalesInvoiceQueryDto } from './dto/sales-invoice-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Sales Invoices')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('sales-invoices')
export class SalesInvoicesController {
  constructor(private readonly salesInvoicesService: SalesInvoicesService) {}

  @Post()
  @Roles(Role.OWNER, Role.EMPLOYEE) // الـ Employee والـ Owner يقدروا يبيعوا بضاعة ويفتحوا فواتير
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a new sales invoice (Deducts stock & updates customer debt)',
  })
  async create(@Body() dto: CreateSalesInvoiceDto, @Request() req: any) {
    const invoice = await this.salesInvoicesService.createInvoice(
      dto,
      req.user.id,
    );
    return {
      success: true,
      message:
        'Sales invoice generated successfully. Inventory and accounting updated.',
      data: invoice,
    };
  }

  @Get()
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Get all sales invoices — paginated, filterable & searchable',
  })
  async findAll(@Query() query: SalesInvoiceQueryDto) {
    const result = await this.salesInvoicesService.findAllInvoices(query);
    return {
      success: true,
      message: 'Sales invoices retrieved successfully',
      data: {
        invoices: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    };
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get sales invoice details by ID' })
  @ApiParam({ name: 'id', description: 'Sales Invoice MongoDB ObjectId' })
  async findOne(@Param('id') id: string) {
    const invoice = await this.salesInvoicesService.findInvoiceById(id);
    return {
      success: true,
      message: 'Sales invoice details retrieved successfully',
      data: invoice,
    };
  }

  @Put(':id')
  @Roles(Role.OWNER) // الـ Owner فقط هو من يملك صلاحية تعديل الحسابات والفواتير المغلقة لضمان الأمان المالي
  @ApiOperation({
    summary:
      'Update an existing sales invoice (Reverts old impact and applies new changes)',
  })
  @ApiParam({ name: 'id', description: 'Sales Invoice MongoDB ObjectId' })
  async update(
    @Param('id') id: string,
    @Body() dto: CreateSalesInvoiceDto,
    @Request() req: any,
  ) {
    const updatedInvoice = await this.salesInvoicesService.updateInvoice(
      id,
      dto,
      req.user.id,
    );
    return {
      success: true,
      message:
        'Sales invoice updated successfully. Inventory and accounting balances recalculated.',
      data: updatedInvoice,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER) // الـ Owner فقط هو اللي يقدر يلغي أو يعمل Soft Delete لفاتورة بيع!
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete/deactivate a sales invoice (Owner only)',
  })
  @ApiParam({ name: 'id', description: 'Sales Invoice MongoDB ObjectId' })
  async remove(@Param('id') id: string) {
    await this.salesInvoicesService.deleteInvoice(id);
    return {
      success: true,
      message: 'Sales invoice soft deleted successfully',
      data: null,
    };
  }
}

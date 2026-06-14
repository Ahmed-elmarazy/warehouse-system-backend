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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { PurchaseInvoiceQueryDto } from './dto/purchase-invoice-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Purchase Invoices')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('purchase-invoices')
export class PurchaseInvoicesController {
  constructor(
    private readonly purchaseInvoicesService: PurchaseInvoicesService,
  ) {}

  // ─── OWNER ONLY ───────────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new purchase invoice and add stock (Owner only)',
  })
  async create(@Body() dto: CreatePurchaseInvoiceDto, @Request() req: any) {
    const invoice = await this.purchaseInvoicesService.createInvoice(
      dto,
      req.user.id,
    );
    return {
      success: true,
      message:
        'Purchase invoice created and inventory incremented successfully',
      data: invoice,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete/deactivate a purchase invoice (Owner only)',
  })
  @ApiParam({ name: 'id', description: 'Purchase Invoice MongoDB ObjectId' })
  async remove(@Param('id') id: string) {
    const result = await this.purchaseInvoicesService.deleteInvoice(id);
    return {
      success: true,
      message: result.message,
      data: null,
    };
  }

  // ─── OWNER + EMPLOYEE ─────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Get all purchase invoices — paginated, filterable & searchable',
  })
  async findAll(@Query() query: PurchaseInvoiceQueryDto) {
    const result = await this.purchaseInvoicesService.findAllInvoices(query);
    return {
      success: true,
      message: 'Purchase invoices retrieved successfully',
      data: {
        invoices: result.data, // مستقر مباشرة من جودة الـ .lean()
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
  @ApiOperation({ summary: 'Get purchase invoice details by ID' })
  @ApiParam({ name: 'id', description: 'Purchase Invoice MongoDB ObjectId' })
  async findOne(@Param('id') id: string) {
    const invoice = await this.purchaseInvoicesService.findInvoiceById(id);
    return {
      success: true,
      message: 'Purchase invoice details retrieved successfully',
      data: invoice,
    };
  }
}

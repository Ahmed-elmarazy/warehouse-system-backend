import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Suppliers')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supplier (Owner only)' })
  async create(@Body() dto: CreateSupplierDto) {
    const supplier = await this.suppliersService.create(dto);
    return {
      success: true,
      message: 'Supplier registered successfully',
      data: supplier,
    };
  }

  @Get()
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get all suppliers — paginated & searchable' })
  async findAll(@Query() query: SupplierQueryDto) {
    const result = await this.suppliersService.findAll(query);
    return {
      success: true,
      message: 'Suppliers retrieved successfully',
      data: {
        suppliers: result.data,
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
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiParam({ name: 'id', description: 'Supplier MongoDB ObjectId' })
  async findOne(@Param('id') id: string) {
    const supplier = await this.suppliersService.findById(id);
    return {
      success: true,
      message: 'Supplier details retrieved successfully',
      data: supplier,
    };
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Update supplier details (Owner only)' })
  @ApiParam({ name: 'id', description: 'Supplier MongoDB ObjectId' })
  async update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    const supplier = await this.suppliersService.update(id, dto);
    return {
      success: true,
      message: 'Supplier updated successfully',
      data: supplier,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Soft delete a supplier (Owner only)' })
  @ApiParam({ name: 'id', description: 'Supplier MongoDB ObjectId' })
  async remove(@Param('id') id: string) {
    const result = await this.suppliersService.remove(id);
    return {
      success: true,
      message: result.message,
      data: null,
    };
  }
}

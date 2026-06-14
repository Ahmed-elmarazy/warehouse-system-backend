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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Customers')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new customer (Owner only)' })
  async create(@Body() dto: CreateCustomerDto) {
    const customer = await this.customersService.create(dto);
    return {
      success: true,
      message: 'Customer registered successfully',
      data: customer,
    };
  }

  @Get()
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get all customers — paginated & searchable' })
  async findAll(@Query() query: CustomerQueryDto) {
    const result = await this.customersService.findAll(query);
    return {
      success: true,
      message: 'Customers retrieved successfully',
      data: {
        customers: result.data,
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
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer MongoDB ObjectId' })
  async findOne(@Param('id') id: string) {
    const customer = await this.customersService.findById(id);
    return {
      success: true,
      message: 'Customer details retrieved successfully',
      data: customer,
    };
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Update customer details (Owner only)' })
  @ApiParam({ name: 'id', description: 'Customer MongoDB ObjectId' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    const customer = await this.customersService.update(id, dto);
    return {
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Soft delete a customer (Owner only)' })
  @ApiParam({ name: 'id', description: 'Customer MongoDB ObjectId' })
  async remove(@Param('id') id: string) {
    const result = await this.customersService.remove(id);
    return {
      success: true,
      message: result.message,
      data: null,
    };
  }

  @Get(':id/statement')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({
    summary:
      'Get detailed dynamic financial statement for a customer (Purchased vs Paid vs Remaining)',
  })
  @ApiParam({ name: 'id', description: 'Customer MongoDB ObjectId' })
  async getStatement(@Param('id') id: string) {
    const statement = await this.customersService.getCustomerStatement(id);
    return {
      success: true,
      message: 'Customer financial statement generated successfully',
      data: statement,
    };
  }
}

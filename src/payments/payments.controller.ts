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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record a new customer payment (Atomically reduces customer debt)',
  })
  async create(@Body() dto: CreatePaymentDto, @Request() req: any) {
    const payment = await this.paymentsService.createPayment(dto, req.user.id);
    return {
      success: true,
      message:
        'Payment received and processed successfully. Customer debt updated.',
      data: payment,
    };
  }

  @Get()
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Get all payment collections — paginated & filterable',
  })
  async findAll(@Query() query: PaymentQueryDto) {
    const result = await this.paymentsService.findAllPayments(query);
    return {
      success: true,
      message: 'Payments ledger retrieved successfully',
      data: {
        payments: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    };
  }

  @Get('customer/:customerId')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Get all payments statement for a specific customer',
  })
  @ApiParam({ name: 'customerId', description: 'Customer MongoDB ObjectId' })
  async findByCustomer(@Param('customerId') customerId: string) {
    const payments =
      await this.paymentsService.findPaymentsByCustomer(customerId);
    return {
      success: true,
      message: 'Customer payments transaction history retrieved',
      data: payments,
    };
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get specific payment receipt details' })
  @ApiParam({ name: 'id', description: 'Payment MongoDB ObjectId' })
  async findOne(@Param('id') id: string) {
    const payment = await this.paymentsService.findPaymentById(id);
    return {
      success: true,
      message: 'Payment receipt details retrieved successfully',
      data: payment,
    };
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'Update payment notes (Owner only - financial safe)',
  })
  @ApiParam({ name: 'id', description: 'Payment MongoDB ObjectId' })
  async update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    const payment = await this.paymentsService.updatePaymentNotes(id, dto);
    return {
      success: true,
      message: 'Payment record notes updated successfully',
      data: payment,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cancel/Soft delete a payment (Owner only - Reverts customer debt back)',
  })
  @ApiParam({ name: 'id', description: 'Payment MongoDB ObjectId' })
  async remove(@Param('id') id: string) {
    await this.paymentsService.deletePayment(id);
    return {
      success: true,
      message:
        'Payment collection canceled successfully. Debt re-applied to customer balance.',
      data: null,
    };
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
import { ReturnsService } from './returns.service';
import { CreateCustomerReturnDto } from './dto/create-customer-return.dto';
import { CreateSupplierReturnDto } from './dto/create-supplier-return.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Returns System')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post('customer')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Process a customer product return (Increases stock & decreases debt)',
  })
  async createCustomerReturn(
    @Body() dto: CreateCustomerReturnDto,
    @Request() req: any,
  ) {
    const data = await this.returnsService.createCustomerReturn(
      dto,
      req.user.id,
    );
    return {
      success: true,
      message:
        'Customer return processed successfully. Balance and inventory adjusted.',
      data,
    };
  }

  @Get('customer')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get all customer returns history' })
  async findAllCustomerReturns() {
    const data = await this.returnsService.getCustomerReturns();
    return {
      success: true,
      message: 'Customer returns retrieved successfully',
      data,
    };
  }

  @Get('customer/:id')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get specific customer return entry details' })
  @ApiParam({ name: 'id' })
  async findCustomerReturnById(@Param('id') id: string) {
    const data = await this.returnsService.getCustomerReturnById(id);
    return {
      success: true,
      message: 'Customer return detailed log fetched',
      data,
    };
  }

  @Post('supplier')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Process a return back to supplier (Decreases stock & reduces supplier outstanding balance)',
  })
  async createSupplierReturn(
    @Body() dto: CreateSupplierReturnDto,
    @Request() req: any,
  ) {
    const data = await this.returnsService.createSupplierReturn(
      dto,
      req.user.id,
    );
    return {
      success: true,
      message: 'Supplier return processed successfully. Inventory decremented.',
      data,
    };
  }

  @Get('supplier')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  async findAllSupplierReturns() {
    const data = await this.returnsService.getSupplierReturns();
    return {
      success: true,
      message: 'Supplier returns log ledger retrieved',
      data,
    };
  }

  @Get('supplier/:id')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiParam({ name: 'id' })
  async findSupplierReturnById(@Param('id') id: string) {
    const data = await this.returnsService.getSupplierReturnById(id);
    return {
      success: true,
      message: 'Supplier return record details fetched',
      data,
    };
  }
}

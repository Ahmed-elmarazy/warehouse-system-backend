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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Employees')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard) // Auth first, then Role check
@Roles(Role.OWNER) // All endpoints: Owner only
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new employee (Owner only)' })
  async create(@Body() dto: CreateEmployeeDto, @Request() req: any) {
    const employee = await this.employeesService.create(dto, req.user.id);
    return {
      success: true,
      message: 'Employee created successfully',
      data: employee.toJSON(),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all employees — paginated + searchable (Owner only)',
  })
  async findAll(@Query() query: EmployeeQueryDto) {
    const result = await this.employeesService.findAll(query);
    return {
      success: true,
      message: 'Employees retrieved successfully',
      data: {
        employees: result.employees.map((e) => e.toJSON()),
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
  @ApiOperation({ summary: 'Get employee by ID (Owner only)' })
  @ApiParam({ name: 'id', description: 'Employee MongoDB ObjectId' })
  async findOne(@Param('id') id: string) {
    const employee = await this.employeesService.findById(id);
    return {
      success: true,
      message: 'Employee retrieved successfully',
      data: employee.toJSON(),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee (Owner only)' })
  @ApiParam({ name: 'id', description: 'Employee MongoDB ObjectId' })
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    const employee = await this.employeesService.update(id, dto);
    return {
      success: true,
      message: 'Employee updated successfully',
      data: employee.toJSON(),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate employee — soft delete (Owner only)' })
  @ApiParam({ name: 'id', description: 'Employee MongoDB ObjectId' })
  async remove(@Param('id') id: string) {
    await this.employeesService.remove(id);
    return {
      success: true,
      message: 'Employee deactivated successfully',
      data: null,
    };
  }
}

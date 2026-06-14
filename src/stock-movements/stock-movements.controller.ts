import {
  Controller,
  Get,
  Post,
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
import { StockMovementsService } from './stock-movements.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Stock Movements')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  // ─── POST /stock-movements (OWNER / SYSTEM ADJUSMENT ONLY) ──────────────────
  @Post()
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create manual stock adjustment / movement log (Owner/System internal only)',
  })
  async create(@Body() dto: CreateStockMovementDto, @Request() req: any) {
    const movement = await this.stockMovementsService.createMovement(
      dto,
      req.user.id,
    );
    return {
      success: true,
      message:
        'Stock movement recorded and product inventory updated successfully',
      data: movement,
    };
  }

  // ─── GET /stock-movements (OWNER + EMPLOYEE VIEW LOGS) ──────────────────────
  @Get()
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({
    summary:
      'Get all stock movements — paginated, searchable, with date range filters',
  })
  async findAll(@Query() query: StockMovementQueryDto) {
    const result = await this.stockMovementsService.findAllMovements(query);
    return {
      success: true,
      message: 'Stock movements logs retrieved successfully',
      data: {
        movements: result.data, // راجعة مجهزة وسريعة بفضل استخدام .lean() في السيرفيس
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    };
  }

  // ─── GET /stock-movements/:id (OWNER + EMPLOYEE VIEW DETAILED LOG) ──────────
  @Get(':id')
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get detailed stock movement log by ID' })
  @ApiParam({ name: 'id', description: 'Stock Movement MongoDB ObjectId' })
  async findOne(@Param('id') id: string) {
    const movement = await this.stockMovementsService.findMovementById(id);
    return {
      success: true,
      message: 'Stock movement log details retrieved successfully',
      data: movement,
    };
  }
}

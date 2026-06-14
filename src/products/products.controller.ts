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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── OWNER ONLY (Mutations) ─────────────────────────────────────────────────

  @Post()
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product (Owner only)' })
  async create(@Body() dto: CreateProductDto, @Request() req: any) {
    const product = await this.productsService.createProduct(dto, req.user.id);
    return {
      success: true,
      message: 'Product created successfully',
      data: product,
    };
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Update an existing product (Owner only)' })
  @ApiParam({ name: 'id', description: 'Product MongoDB ObjectId' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Request() req: any,
  ) {
    const product = await this.productsService.updateProduct(
      id,
      dto,
      req.user.id,
    );
    return {
      success: true,
      message: 'Product updated successfully',
      data: product,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a product (Owner only)' })
  @ApiParam({ name: 'id', description: 'Product MongoDB ObjectId' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const result = await this.productsService.deleteProduct(id, req.user.id);
    return {
      success: true,
      message: result.message,
      data: null,
    };
  }

  // ─── OWNER + EMPLOYEE (Queries) ─────────────────────────────────────────────

  @Get()
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Get all active products — paginated + searchable + filterable',
  })
  async findAll(@Query() query: ProductQueryDto) {
    const result = await this.productsService.findAllProducts(query);
    return {
      success: true,
      message: 'Products retrieved successfully',
      data: {
        products: result.data, // راجع جاهز وخفيف من الـ lean() مباشرة
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
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product MongoDB ObjectId' })
  async findOne(@Param('id') id: string) {
    const product = await this.productsService.findProductById(id);
    return {
      success: true,
      message: 'Product retrieved successfully',
      data: product,
    };
  }
}

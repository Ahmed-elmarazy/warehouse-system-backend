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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── OWNER ONLY ───────────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category (Owner only)' })
  async create(@Body() dto: CreateCategoryDto, @Request() req: any) {
    const category = await this.categoriesService.createCategory(
      dto,
      req.user.id,
    );
    return {
      success: true,
      message: 'Category created successfully',
      data: category.toJSON(),
    };
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Update a category (Owner only)' })
  @ApiParam({ name: 'id', description: 'Category MongoDB ObjectId' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Request() req: any,
  ) {
    const category = await this.categoriesService.updateCategory(
      id,
      dto,
      req.user.id,
    );
    return {
      success: true,
      message: 'Category updated successfully',
      data: category.toJSON(),
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a category (Owner only)' })
  @ApiParam({ name: 'id', description: 'Category MongoDB ObjectId' })
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.categoriesService.deleteCategory(id, req.user.id);
    return {
      success: true,
      message: 'Category deactivated successfully',
      data: null,
    };
  }

  // ─── OWNER + EMPLOYEE ─────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.OWNER, Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Get all active categories — paginated + searchable',
  })
  async findAll(@Query() query: CategoryQueryDto) {
    const result = await this.categoriesService.findAllCategories(query);
    return {
      success: true,
      message: 'Categories retrieved successfully',
      data: {
        categories: result.categories.map((c) => c.toJSON()),
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
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'id', description: 'Category MongoDB ObjectId' })
  async findOne(@Param('id') id: string) {
    const category = await this.categoriesService.findCategoryById(id);
    return {
      success: true,
      message: 'Category retrieved successfully',
      data: category.toJSON(),
    };
  }
}

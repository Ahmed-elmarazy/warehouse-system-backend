// 📄 src/categories/categories.service.ts

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { Product } from '../products/schemas/product.schema'; // استيراد اسكيمة المنتجات للتحقق من عدم الحذف العشوائي

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,

    @InjectModel('Product')
    private readonly productModel: Model<any>, // حقن موديل المنتجات لحماية الكاتيجوري من الحذف الخاطئ
  ) {}

  // ─── Create ──────────────────────────────────────────────────────────────────
  async createCategory(
    dto: CreateCategoryDto,
    userId: string,
  ): Promise<CategoryDocument> {
    await this.assertNameUnique(dto.name);

    return this.categoryModel.create({
      name: dto.name,
      description: dto.description ?? null,
      createdBy: new Types.ObjectId(userId),
    });
  }

  // ─── Find All (paginated + search) ───────────────────────────────────────────
  async findAllCategories(query: CategoryQueryDto): Promise<{
    categories: CategoryDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, search, includeInactive } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (!includeInactive) {
      filter.isActive = true;
    }

    if (search?.trim()) {
      filter['name'] = { $regex: search.trim(), $options: 'i' };
    }

    const [categories, total] = await Promise.all([
      this.categoryModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.categoryModel.countDocuments(filter).exec(),
    ]);

    return {
      categories,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Find By ID ───────────────────────────────────────────────────────────────
  async findCategoryById(id: string): Promise<CategoryDocument> {
    this.assertValidId(id);

    const category = await this.categoryModel
      .findOne({ _id: id, isActive: true })
      .exec();

    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // ─── Update ───────────────────────────────────────────────────────────────────
  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    userId: string,
  ): Promise<CategoryDocument> {
    this.assertValidId(id);

    if (dto.name) {
      const conflict = await this.categoryModel
        .findOne({ name: dto.name, _id: { $ne: id } })
        .exec();
      if (conflict) {
        throw new ConflictException(
          `A category with the name "${dto.name}" already exists`,
        );
      }
    }

    const updated = await this.categoryModel
      .findByIdAndUpdate(
        id,
        { $set: { ...dto, updatedBy: new Types.ObjectId(userId) } },
        { new: true },
      )
      .exec();

    if (!updated) throw new NotFoundException('Category not found');
    return updated;
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────────────
  async deleteCategory(id: string, userId: string): Promise<void> {
    this.assertValidId(id);

    const category = await this.categoryModel.findById(id).exec();
    if (!category) throw new NotFoundException('Category not found');

    if (!category.isActive) {
      throw new BadRequestException('Category is already deactivated');
    }

    // حماية: منع حذف الفئة لو فيه منتجات مربوطة بيها
    await this.assertNotReferenced(id);

    await this.categoryModel
      .findByIdAndUpdate(id, {
        $set: { isActive: false, updatedBy: new Types.ObjectId(userId) },
      })
      .exec();
  }

  // ─── Internal helper ──────────────────
  async assertCategoryExists(id: string): Promise<CategoryDocument> {
    this.assertValidId(id);
    const category = await this.categoryModel
      .findOne({ _id: id, isActive: true })
      .exec();
    if (!category) {
      throw new NotFoundException(
        `Category with ID "${id}" not found or inactive`,
      );
    }
    return category;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────
  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID');
    }
  }

  private async assertNameUnique(name: string): Promise<void> {
    const existing = await this.categoryModel.findOne({ name }).exec();
    if (existing) {
      throw new ConflictException(
        `A category with the name "${name}" already exists`,
      );
    }
  }

  // تم تفعيل الفحص للمنتجات فقط بعد حذف الساب-كاتيجوري تماماً
  private async assertNotReferenced(_id: string): Promise<void> {
    const productCount = await this.productModel
      .countDocuments({ categoryId: new Types.ObjectId(_id), isActive: true })
      .exec();
    if (productCount > 0) {
      throw new BadRequestException(
        'Cannot delete category: it has active products linked to it',
      );
    }
  }
}

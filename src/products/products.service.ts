// 📄 src/products/products.service.ts

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,

    @InjectModel('Category')
    private readonly categoryModel: Model<any>,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────
  async createProduct(
    dto: CreateProductDto,
    ownerId: string,
  ): Promise<ProductDocument> {
    const categoryId = this.toObjectId(dto.categoryId, 'categoryId');

    // 1. Validate category exists
    await this.ensureCategoryExists(categoryId);

    // 2. Code must be globally unique
    await this.ensureUniqueCode(dto.code);

    // 3. Business rule: minimumQuantity must be <= maximumQuantity
    if (dto.minimumQuantity > dto.maximumQuantity) {
      throw new BadRequestException(
        'minimumQuantity must be less than or equal to maximumQuantity',
      );
    }

    const product = new this.productModel({
      name: dto.name,
      code: dto.code,
      categoryId,
      purchasePrice: dto.purchasePrice,
      cartonPrice: dto.cartonPrice,
      piecePrice: dto.piecePrice,
      piecesPerCarton: dto.piecesPerCarton,
      quantityInPieces: dto.quantityInPieces ?? 0, // الرصيد الابتدائي عند التأسيس فقط
      minimumQuantity: dto.minimumQuantity,
      maximumQuantity: dto.maximumQuantity,
      notes: dto.notes ?? null,
      isActive: true,
      createdBy: new Types.ObjectId(ownerId),
    });

    return product.save();
  }

  // ─── Find All ─────────────────────────────────────────────────────────────
  async findAllProducts(query: ProductQueryDto): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, search, categoryId } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { isActive: true };

    if (search) {
      const escaped = this.escapeRegex(search);
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { code: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (categoryId)
      filter.categoryId = this.toObjectId(categoryId, 'categoryId');

    const [data, total] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('categoryId', 'name _id')
        .populate('createdBy', 'name email _id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Find One ─────────────────────────────────────────────────────────────
  // 💡 دعم الـ session اختياريًا لضمان قراءة أدق الكميات أثناء جرد الفواتير
  async findProductById(id: string, session?: any): Promise<ProductDocument> {
    const product = await this.productModel
      .findOne({ _id: this.toObjectId(id, 'id'), isActive: true })
      .session(session) // 👈 ربط السيسشن إن وجدت
      .populate('categoryId', 'name _id')
      .populate('createdBy', 'name email _id')
      .populate('updatedBy', 'name email _id')
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return product;
  }

  // ─── Update ───────────────────────────────────────────────────────────────
  async updateProduct(
    id: string,
    dto: UpdateProductDto,
    ownerId: string,
    session?: any, // 👈 تمرير الـ session لحماية التحديث المتزامن
  ): Promise<ProductDocument> {
    const existing = await this.productModel
      .findOne({ _id: this.toObjectId(id, 'id'), isActive: true })
      .session(session);

    if (!existing) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    const finalCategoryId = dto.categoryId
      ? this.toObjectId(dto.categoryId, 'categoryId')
      : existing.categoryId;

    if (dto.code && dto.code !== existing.code) {
      await this.ensureUniqueCode(dto.code, id, session);
    }

    const newMin = dto.minimumQuantity ?? existing.minimumQuantity;
    const newMax = dto.maximumQuantity ?? existing.maximumQuantity;
    if (newMin > newMax) {
      throw new BadRequestException(
        'minimumQuantity must be less than or equal to maximumQuantity',
      );
    }

    const payload: Record<string, any> = {
      updatedBy: new Types.ObjectId(ownerId),
    };

    // 🛡️ حماية صارمة: منع الـ Payload من استقبال أو تعديل الرصيد يدوياً
    const directFields = [
      'name',
      'code',
      'purchasePrice',
      'cartonPrice',
      'piecePrice',
      'piecesPerCarton',
      'minimumQuantity',
      'maximumQuantity',
      'notes',
      'isActive',
    ] as const;

    for (const field of directFields) {
      if (dto[field] !== undefined) payload[field] = dto[field];
    }

    if (dto.categoryId) payload.categoryId = finalCategoryId;

    const updated = await this.productModel
      .findByIdAndUpdate(
        existing._id,
        { $set: payload },
        { new: true, session }, // 👈 تمرير الـ session هنا
      )
      .populate('categoryId', 'name _id')
      .exec();

    return updated!;
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────────
  async deleteProduct(
    id: string,
    ownerId: string,
    session?: any,
  ): Promise<{ message: string }> {
    const existing = await this.productModel
      .findOne({ _id: this.toObjectId(id, 'id'), isActive: true })
      .session(session);

    if (!existing) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    await this.productModel.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          isActive: false,
          updatedBy: new Types.ObjectId(ownerId),
        },
      },
      { session }, // 👈 تمرير الـ session
    );

    return { message: `Product "${existing.name}" has been deleted` };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private toObjectId(value: string, field: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`"${field}" is not a valid ObjectId`);
    }
    return new Types.ObjectId(value);
  }

  private async ensureCategoryExists(
    categoryId: Types.ObjectId,
    session?: any,
  ): Promise<void> {
    const exists = await this.categoryModel
      .findOne({ _id: categoryId, isActive: true })
      .session(session)
      .lean()
      .exec();

    if (!exists) {
      throw new NotFoundException(
        `Category with id "${categoryId}" not found or is inactive`,
      );
    }
  }

  private async ensureUniqueCode(
    code: string,
    excludeId?: string,
    session?: any,
  ): Promise<void> {
    const filter: Record<string, any> = {
      code: { $regex: `^${this.escapeRegex(code)}$`, $options: 'i' },
      isActive: true,
    };

    if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId) };

    const duplicate = await this.productModel
      .findOne(filter)
      .session(session)
      .lean()
      .exec();

    if (duplicate) {
      throw new ConflictException(
        `A product with code "${code}" already exists`,
      );
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

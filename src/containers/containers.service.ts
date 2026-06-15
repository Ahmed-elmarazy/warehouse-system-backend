import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Container, ContainerDocument } from './schemas/container.schema';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';

@Injectable()
export class ContainersService {
  constructor(
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
  ) {}

  // 1. إضافة حاوية جديدة مع حساب المتبقي (الحقول الجديدة بتدخل تلقائياً هنا)
  async create(dto: CreateContainerDto): Promise<Container> {
    const totalPrice = dto.totalPrice;
    const paidAmount = dto.paidAmount ?? 0;
    const remainingAmount = totalPrice - paidAmount;

    const createdContainer = new this.containerModel({
      ...dto,
      remainingAmount,
    });

    return createdContainer.save();
  }

  // 2. تعديل حاوية أو دفع جزء مالي مع إعادة حساب المتبقي بدقة
  async update(id: string, dto: UpdateContainerDto): Promise<Container> {
    const container = await this.containerModel.findById(id);
    if (!container) throw new NotFoundException('الحاوية غير موجودة');

    // تحديث الحقول المرسلة
    if (dto.containerNumber) container.containerNumber = dto.containerNumber;
    if (dto.totalPrice !== undefined) container.totalPrice = dto.totalPrice;
    if (dto.paidAmount !== undefined) container.paidAmount = dto.paidAmount;
    if (dto.arrivalDate) container.arrivalDate = new Date(dto.arrivalDate);
    if (dto.notes) container.notes = dto.notes;

    // 🔥 الحقول الجديدة المضافة في التعديل:
    if (dto.origin) container.origin = dto.origin;
    if (dto.contentDetails) container.contentDetails = dto.contentDetails;

    // إعادة الحساب مباشرةً هنا في السيرفيس
    container.remainingAmount = container.totalPrice - container.paidAmount;

    return container.save();
  }

  // 3. جلب كل الحاويات مع بحث مرن (تم تطويره ليشمل الحقول الجديدة)
  async findAll(search?: string): Promise<Container[]> {
    const filter: Record<string, any> = {};

    if (search) {
      filter.$or = [
        { containerNumber: { $regex: search, $options: 'i' } },
        { origin: { $regex: search, $options: 'i' } }, // 👈 ميزة البحث ببلد المنشأ/المورد
        { contentDetails: { $regex: search, $options: 'i' } }, // 👈 ميزة البحث بكلمة جوة المحتويات
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    return this.containerModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  // 4. جلب حاوية واحدة بالتفصيل
  async findOne(id: string): Promise<Container> {
    const container = await this.containerModel.findById(id).exec();
    if (!container) throw new NotFoundException('الحاوية غير موجودة');
    return container;
  }

  // 5. حذف حاوية
  async remove(id: string) {
    const result = await this.containerModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('الحاوية غير موجودة');
    return { success: true, message: 'تم حذف الحاوية بنجاح' };
  }
}

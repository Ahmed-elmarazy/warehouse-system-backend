// 📄 src/search/search.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SearchQueryDto, SearchEntityType } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel('Product') private readonly productModel: Model<any>,
    @InjectModel('Customer') private readonly customerModel: Model<any>,
    @InjectModel('Supplier') private readonly supplierModel: Model<any>,
    @InjectModel('SalesInvoice') private readonly salesInvoiceModel: Model<any>,
    @InjectModel('PurchaseInvoice')
    private readonly purchaseInvoiceModel: Model<any>,
    @InjectModel('Payment') private readonly paymentModel: Model<any>, // تأكد من اسم الموديل عندك
  ) {}

  async globalSearch(dto: SearchQueryDto) {
    const { q, type, page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    // إنشاء التعبير المنتظم للبحث المرن (Case-Insensitive)
    const searchRegex = new RegExp(q.trim(), 'i');

    // تجهيز الهيكل الفارغ للاستجابة الموحدة
    const results = {
      products: [],
      customers: [],
      suppliers: [],
      salesInvoices: [],
      purchaseInvoices: [],
      payments: [],
    };

    // تعريف الـ Tasks لكل كيان كـ Functions لتنفيذها عند الحاجة فقط
    const searchTasks: Record<SearchEntityType, () => Promise<any>> = {
      [SearchEntityType.PRODUCTS]: () =>
        this.productModel
          .find({
            isActive: true,
            $or: [{ name: searchRegex }, { code: searchRegex }],
          })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),

      [SearchEntityType.CUSTOMERS]: () =>
        this.customerModel
          .find({
            isActive: true,
            $or: [{ name: searchRegex }, { phone: searchRegex }],
          })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),

      [SearchEntityType.SUPPLIERS]: () =>
        this.supplierModel
          .find({
            isActive: true,
            $or: [{ name: searchRegex }, { phone: searchRegex }],
          })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),

      [SearchEntityType.SALES_INVOICES]: () =>
        this.salesInvoiceModel
          .find({ isActive: true, invoiceNumber: searchRegex })
          .populate('customerId', 'name customerCode')
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),

      [SearchEntityType.PURCHASE_INVOICES]: () =>
        this.purchaseInvoiceModel
          .find({ isActive: true, invoiceNumber: searchRegex })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),

      [SearchEntityType.PAYMENTS]: () =>
        this.paymentModel
          .find({ isActive: true, paymentNumber: searchRegex })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
    };

    // 🏎️ تحسين الأداء: لو المستخدم حدد نوع معين (مثلاً منتجات بس)، بنفذ الاستعلام ده لوحده
    if (type) {
      results[type] = await searchTasks[type]();
      return results;
    }

    // 🔥 الـ Parallel Execution: البحث في كل الجداول دفعة واحدة في نفس الملي ثانية
    const [
      products,
      customers,
      suppliers,
      salesInvoices,
      purchaseInvoices,
      payments,
    ] = await Promise.all([
      searchTasks[SearchEntityType.PRODUCTS](),
      searchTasks[SearchEntityType.CUSTOMERS](),
      searchTasks[SearchEntityType.SUPPLIERS](),
      searchTasks[SearchEntityType.SALES_INVOICES](),
      searchTasks[SearchEntityType.PURCHASE_INVOICES](),
      searchTasks[SearchEntityType.PAYMENTS](),
    ]);

    // دمج النتائج داخل الكائن الموحد
    results.products = products;
    results.customers = customers;
    results.suppliers = suppliers;
    results.salesInvoices = salesInvoices;
    results.purchaseInvoices = purchaseInvoices;
    results.payments = payments;

    return results;
  }
}

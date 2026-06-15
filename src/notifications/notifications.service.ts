// 📄 src/notifications/notifications.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly gateway: NotificationsGateway,
  ) {}

  // 1️⃣ إنشاء التنبيه وبثه فوراً بالـ WebSockets
  async create(dto: CreateNotificationDto): Promise<NotificationDocument> {
    const newNotification = new this.notificationModel(dto);
    const saved = await newNotification.save();

    // بث فوري للفرونتد عبر الـ Gateway
    this.gateway.emitNotification(saved);
    return saved;
  }

  // 2️⃣ جلب الإشعارات مع فلترة مخصصة بالـ Scope والأدوار
  async findAll(queryDto: NotificationQueryDto, user: any) {
    const { type, severity, page = 1, limit = 20 } = queryDto;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity;

    // الـ Employee يشوف إشعارات الـ Inventory والـ System فقط، والـ Owner يشوف كله
    if (user.role === 'EMPLOYEE') {
      filter.type = { $in: ['INVENTORY', 'SYSTEM'] };
    }

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      notifications,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markAsRead(id: string): Promise<void> {
    const result = await this.notificationModel
      .findByIdAndUpdate(id, { isRead: true })
      .exec();
    if (!result) throw new NotFoundException('Notification not found');
  }

  async markAllAsRead(user: any): Promise<void> {
    const filter: Record<string, any> = {};
    if (user.role === 'EMPLOYEE') {
      filter.type = { $in: ['INVENTORY', 'SYSTEM'] };
    }
    await this.notificationModel.updateMany(filter, { isRead: true }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.notificationModel.findByIdAndDelete(id).exec();
  }

  // ─── 🧠 AUTOMATIC EVENT LISTENERS (الربط التلقائي بدون تعديل القديم) ───

  // 📄 src/notifications/notifications.service.ts
  // استبدل دالة handleStockMovement القديمة بالدالة النظيفة دي:

  // أ. الاستماع لحركة المخزن وضبط تنبيهات النواقص والراكد بناءً على محددات المنتج حصرًا
  @OnEvent('stock.movement.updated')
  async handleStockMovement(payload: {
    productId: string;
    productName: string;
    newQty: number;
    minQty: number;
    maxQty: number;
  }) {
    // 1️⃣ حالة النفاد التام (أعلى أولية)
    if (payload.newQty === 0) {
      await this.create({
        type: 'INVENTORY',
        title: '🚨 بضاعة منتهية! (Out of Stock)',
        message: `المنتج [${payload.productName}] رصيده أصبح صفر بالمخزن!`,
        entityType: 'Product',
        entityId: payload.productId,
        severity: 'HIGH',
      });
      return; // 🔥 الـ return هنا جوهرية عشان نمنع تكرار الإشعار مع الشرط اللي تحته
    }

    // 2️⃣ حالة النواقص (تشتغل فقط لو الرصيد أكبر من صفر وأقل من أو يساوي حد الأمان)
    if (payload.newQty <= payload.minQty) {
      await this.create({
        type: 'INVENTORY',
        title: '⚠️ نقص في المخزون (Low Stock)',
        message: `المنتج [${payload.productName}] تخطى حد الأمان الأدنى المسموح به (${payload.minQty} قطعة). الكمية الحالية في المخزن: ${payload.newQty} قطعة فقط.`,
        entityType: 'Product',
        entityId: payload.productId,
        severity: 'MEDIUM',
      });
      return;
    }

    // 3️⃣ حالة التكدس والراكد (تشتغل لو تخطى الحد الأقصى)
    if (payload.newQty >= payload.maxQty) {
      await this.create({
        type: 'INVENTORY',
        title: '📦 تكدس مخزني (Overstock)',
        message: `المنتج [${payload.productName}] تخطى الحد الأقصى الاستراتيجي للمخزن (${payload.maxQty} قطعة). الرصيد الحالي: ${payload.newQty} قطعة.`,
        entityType: 'Product',
        entityId: payload.productId,
        severity: 'LOW',
      });
    }
  }
  // ب. الاستماع لفواتير البيع الجديدة (الربط المالي)
  @OnEvent('sales.invoice.created')
  async handleSalesInvoice(invoice: {
    id: string;
    invoiceNumber: string;
    finalAmount: number;
    customerName: string;
  }) {
    await this.create({
      type: 'SYSTEM',
      title: '🧾 فاتورة بيع جديدة',
      message: `تم إنشاء فاتورة بيع رقم [${invoice.invoiceNumber}] للعميل ${invoice.customerName} بقيمة ${invoice.finalAmount}`,
      entityType: 'SalesInvoice',
      entityId: invoice.id,
      severity: 'LOW',
    });
  }

  // ج. الاستماع للديون العالية للعملاء (Financial Risks)
  @OnEvent('customer.debt.exceeded')
  async handleCustomerDebt(customer: {
    id: string;
    name: string;
    currentDebt: number;
  }) {
    await this.create({
      type: 'FINANCIAL',
      title: '💰 خطر مالي: مديونية مرتفعة للعميل!',
      message: `تخطى العميل [${customer.name}] حد الائتمان المسموح، مديونيته الحالية: ${customer.currentDebt}`,
      entityType: 'Customer',
      entityId: customer.id,
      severity: 'HIGH',
    });
  }

  // د. 🔔 الاستماع لـ سداد مديونيات العملاء تلقائياً (الربط المالي الجديد) 💸
  @OnEvent('customer.payment.received')
  async handleCustomerPayment(payment: {
    id: string;
    paymentNumber: string;
    amountReceived: number;
    paymentMethod: string;
    customerName: string;
  }) {
    await this.create({
      type: 'FINANCIAL',
      title: '💰 سند سداد مالي جديد',
      message: `تم استلام دفعة بقيمة ${payment.amountReceived} ج من العميل [${payment.customerName}] عبر وسيلة [${payment.paymentMethod}] برقم سند ${payment.paymentNumber}`,
      entityType: 'Payment',
      entityId: payment.id,
      severity: 'MEDIUM', // أهمية متوسطة لمراقبة التدفق المالي لايف
    });
  }
}

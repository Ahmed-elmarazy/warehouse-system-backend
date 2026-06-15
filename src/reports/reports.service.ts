/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 📐 المنطق المحاسبي المصحح والمعتمد
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel('Product') private readonly productModel: Model<any>,
    @InjectModel('Customer') private readonly customerModel: Model<any>,
    @InjectModel('Supplier') private readonly supplierModel: Model<any>,
    @InjectModel('SalesInvoice') private readonly salesInvoiceModel: Model<any>,
    @InjectModel('CustomerReturn')
    private readonly customerReturnModel: Model<any>,
    @InjectModel('PurchaseInvoice')
    private readonly purchaseInvoiceModel: Model<any>,
    @InjectModel('StockMovement')
    private readonly stockMovementModel: Model<any>,
  ) {}

  async getDashboardAnalytics(dto: ReportQueryDto) {
    const { from, to } = dto; // ─── بناء فلتر التاريخ ────────────────────────────────────────────────────

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let dateRange: Record<string, any>;
    if (from || to) {
      dateRange = {};
      if (from) dateRange.$gte = new Date(from);
      if (to) {
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        dateRange.$lte = endDate;
      }
    } else {
      dateRange = { $gte: todayStart, $lte: todayEnd };
    }

    const invoiceDateFilter: Record<string, any> = {
      isActive: true,
      createdAt: dateRange,
    };

    const returnDateFilter: Record<string, any> = {
      isActive: true,
      createdAt: dateRange,
    };

    const stockDateFilter: Record<string, any> = {
      createdAt: dateRange,
    }; // ─────────────────────────────────────────────────────────────────────────
    const [
      salesReport,
      profitReport,
      returnsReport,
      inventoryReport,
      customerDebtReport,
      supplierReport,
      stockMovementReport,
    ] = await Promise.all([
      // ════════════════════════════════════════════════════════════════════════
      // 📅 1. SALES REPORT
      // ════════════════════════════════════════════════════════════════════════
      this.salesInvoiceModel.aggregate([
        { $match: invoiceDateFilter },
        {
          $group: {
            _id: null,
            totalInvoicesValue: { $sum: '$finalAmount' },
            totalCollected: { $sum: '$paidAmount' },
            totalRemaining: { $sum: '$remainingAmount' },
            numberOfInvoices: { $sum: 1 },
            averageInvoiceValue: { $avg: '$finalAmount' },
          },
        },
        { $project: { _id: 0 } },
      ]), // ════════════════════════════════════════════════════════════════════════
      // 💰 2. PROFIT ANALYSIS REPORT
      // ════════════════════════════════════════════════════════════════════════

      this.salesInvoiceModel.aggregate([
        { $match: invoiceDateFilter },
        {
          $addFields: {
            paymentRatio: {
              $cond: [
                { $eq: ['$finalAmount', 0] },
                0,
                { $divide: ['$paidAmount', '$finalAmount'] },
              ],
            },
          },
        },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'productInfo',
          },
        },
        { $unwind: '$productInfo' },
        {
          $project: {
            productId: '$items.productId',
            productName: '$productInfo.name',
            paymentRatio: 1,
            itemCollectedRevenue: {
              $multiply: ['$items.total', '$paymentRatio'],
            },
            itemCollectedCost: {
              $multiply: [
                {
                  $multiply: [
                    { $ifNull: ['$items.totalPieces', '$items.quantity'] },
                    { $ifNull: ['$productInfo.purchasePrice', 0] },
                  ],
                },
                '$paymentRatio',
              ],
            },
          },
        },
        {
          $addFields: {
            itemCollectedProfit: {
              $subtract: ['$itemCollectedRevenue', '$itemCollectedCost'],
            },
          },
        },
        {
          $group: {
            _id: '$productId',
            productName: { $first: '$productName' },
            collectedRevenue: { $sum: '$itemCollectedRevenue' },
            collectedCost: { $sum: '$itemCollectedCost' },
            collectedProfit: { $sum: '$itemCollectedProfit' },
          },
        },
        {
          $group: {
            _id: null,
            totalCollectedRevenue: { $sum: '$collectedRevenue' },
            totalCollectedCost: { $sum: '$collectedCost' },
            totalCollectedProfit: { $sum: '$collectedProfit' },
            productsProfitBreakdown: {
              $push: {
                productId: '$_id',
                productName: '$productName',
                collectedRevenue: { $round: ['$collectedRevenue', 2] },
                collectedCost: { $round: ['$collectedCost', 2] },
                collectedProfit: { $round: ['$collectedProfit', 2] },
              },
            },
          },
        },
      ]), // ════════════════════════════════════════════════════════════════════════
      // 🔄 3. RETURNS REPORT
      // ════════════════════════════════════════════════════════════════════════

      this.customerReturnModel.aggregate([
        { $match: returnDateFilter },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$returnType',
            totalReturnedAmount: { $sum: '$items.total' },
            totalReturnedCost: {
              $sum: {
                $cond: [
                  { $gt: ['$items.totalCost', 0] },
                  '$items.totalCost',
                  {
                    $cond: [
                      { $gt: ['$items.purchasePrice', 0] },
                      {
                        $multiply: ['$items.quantity', '$items.purchasePrice'],
                      },
                      0,
                    ],
                  },
                ],
              },
            },
          },
        },
        {
          $addFields: {
            returnedProfit: {
              $subtract: ['$totalReturnedAmount', '$totalReturnedCost'],
            },
          },
        },
        {
          $group: {
            _id: null,
            cashReturnAmount: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'CASH'] }, '$totalReturnedAmount', 0],
              },
            },
            cashReturnCost: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'CASH'] }, '$totalReturnedCost', 0],
              },
            },
            cashReturnedProfit: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'CASH'] }, '$returnedProfit', 0],
              },
            },
            creditReturnAmount: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'CREDIT'] }, '$totalReturnedAmount', 0],
              },
            },
            creditReturnCost: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'CREDIT'] }, '$totalReturnedCost', 0],
              },
            },
            creditReturnedProfit: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'CREDIT'] }, '$returnedProfit', 0],
              },
            },
          },
        },
        {
          $addFields: {
            totalReturnedAmount: {
              $add: ['$cashReturnAmount', '$creditReturnAmount'],
            },
            totalReturnedProfit: {
              $add: ['$cashReturnedProfit', '$creditReturnedProfit'],
            },
          },
        },
        { $project: { _id: 0 } },
      ]), // ════════════════════════════════════════════════════════════════════════
      // 📦 4. INVENTORY REPORT
      // ════════════════════════════════════════════════════════════════════════

      this.productModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            outOfStockProducts: {
              $sum: { $cond: [{ $eq: ['$quantityInPieces', 0] }, 1, 0] },
            },
            lowStockProducts: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$quantityInPieces', 0] },
                      { $lte: ['$quantityInPieces', '$minimumQuantity'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            overstockProducts: {
              $sum: {
                $cond: [
                  { $gt: ['$quantityInPieces', '$maximumQuantity'] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $project: { _id: 0 } },
      ]), // ════════════════════════════════════════════════════════════════════════
      // 👤 5. CUSTOMER DEBT REPORT (تم تعديله ليقرأ الديون الصافية والمحدثة)
      // ════════════════════════════════════════════════════════════════════════

      this.customerModel.aggregate([
        { $match: { isActive: true, currentDebt: { $gt: 0 } } },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalOutstandingDebt: { $sum: '$currentDebt' },
                },
              },
            ],
            topDebtors: [
              { $sort: { currentDebt: -1 } },
              { $limit: 10 },
              {
                $project: {
                  _id: '$_id',
                  name: '$name',
                  phone: '$phone',
                  debt: '$currentDebt',
                },
              },
            ],
          },
        },
        {
          $project: {
            totalOutstandingDebt: {
              $ifNull: [
                { $arrayElemAt: ['$summary.totalOutstandingDebt', 0] },
                0,
              ],
            },
            top10CustomersByDebt: '$topDebtors',
          },
        },
      ]), // ════════════════════════════════════════════════════════════════════════
      // 🚚 6. SUPPLIER SUMMARY REPORT
      // ════════════════════════════════════════════════════════════════════════

      this.supplierModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalSuppliers: { $sum: 1 },
            totalOutstandingBalances: { $sum: '$balance' },
          },
        },
        { $project: { _id: 0 } },
      ]), // ════════════════════════════════════════════════════════════════════════
      // 📊 7. STOCK MOVEMENT ANALYTICS
      // ════════════════════════════════════════════════════════════════════════

      this.stockMovementModel.aggregate([
        { $match: stockDateFilter },
        {
          $group: {
            _id: null,
            totalStockIN: {
              $sum: {
                $cond: [
                  { $gt: ['$quantityChanged', 0] },
                  '$quantityChanged',
                  0,
                ],
              },
            },
            totalStockOUT: {
              $sum: {
                $cond: [
                  { $eq: [{ $lt: ['$quantityChanged', 0] }, true] },
                  '$quantityChanged',
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalStockIN: 1,
            totalStockOUT: { $abs: '$totalStockOUT' },
          },
        },
      ]),
    ]); // ══════════════════════════════════════════════════════════════════════════
    // 🧮 الحسابات النهائية المصححة والمقفلّة بالمليم
    // ══════════════════════════════════════════════════════════════════════════

    const sales = salesReport[0] || {
      totalInvoicesValue: 0,
      totalCollected: 0,
      totalRemaining: 0,
      numberOfInvoices: 0,
      averageInvoiceValue: 0,
    };

    const profitRaw = profitReport[0] || {
      totalCollectedRevenue: 0,
      totalCollectedCost: 0,
      totalCollectedProfit: 0,
      productsProfitBreakdown: [],
    };

    const returns = returnsReport[0] || {
      cashReturnAmount: 0,
      cashReturnCost: 0,
      cashReturnedProfit: 0,
      creditReturnAmount: 0,
      creditReturnCost: 0,
      creditReturnedProfit: 0,
      totalReturnedAmount: 0,
      totalReturnedProfit: 0,
    }; // 1. صافي قيمة المبيعات (إجمالي الفواتير - كل المرتجعات)
    // 1. صافي قيمة المبيعات (إجمالي الفواتير - كل المرتجعات)

    const netSalesValue =
      sales.totalInvoicesValue - returns.totalReturnedAmount; // 2. الكاش الفعلي المحصل في الخزنة (المدفوع فواتير - مرتجعات الكاش)

    const netCollected = sales.totalCollected - returns.cashReturnAmount; // 3. المديونية المتبقية الفورية (المتبقي من الفواتير - مرتجعات الآجل)

    const netRemaining = sales.totalRemaining - returns.creditReturnAmount; // 4. ✅ التعديل الصح لصافي الربح:
    // استخدام القيم الفعلية المحسوبة من الداتا بيز بدلاً من النسبة التقريبية

    const netProfit = Math.max(
      0,
      profitRaw.totalCollectedProfit - returns.cashReturnedProfit,
    ); // 5. نسبة هامش الربح الحقيقية بناءً على الأرباح الصافية

    const profitMarginPercentage =
      netCollected > 0 ? (netProfit / netCollected) * 100 : 0; // 6. ✅ تفاصيل المنتجات: عرض الأرقام الفعلية دون توزيع نسبة المرتجع على منتجات ملهاش علاقة

    const finalProductsBreakdown = profitRaw.productsProfitBreakdown.map(
      (p: any) => ({
        productId: p.productId,
        productName: p.productName,
        collectedRevenue: Math.round(p.collectedRevenue * 100) / 100,
        collectedCost: Math.round(p.collectedCost * 100) / 100,
        collectedProfit: Math.round(p.collectedProfit * 100) / 100,
      }),
    );

    return {
      sales: {
        numberOfInvoices: sales.numberOfInvoices,
        averageInvoiceValue: Math.round(sales.averageInvoiceValue * 100) / 100,
        totalInvoicesValue: Math.round(sales.totalInvoicesValue * 100) / 100,
        totalReturns: {
          total: Math.round(returns.totalReturnedAmount * 100) / 100,
          cashReturns: Math.round(returns.cashReturnAmount * 100) / 100,
          creditReturns: Math.round(returns.creditReturnAmount * 100) / 100,
        },
        netSalesValue: Math.round(netSalesValue * 100) / 100,
        totalCollected: Math.max(0, Math.round(netCollected * 100) / 100),
        totalRemaining: Math.max(0, Math.round(netRemaining * 100) / 100),
      },
      profit: {
        grossCollectedProfit:
          Math.round(profitRaw.totalCollectedProfit * 100) / 100,
        lostProfitFromReturns: {
          total: Math.round(returns.totalReturnedProfit * 100) / 100,
          fromCashReturns: Math.round(returns.cashReturnedProfit * 100) / 100,
          fromCreditReturns:
            Math.round(returns.creditReturnedProfit * 100) / 100,
        },
        totalProfit: Math.max(0, Math.round(netProfit * 100) / 100),
        profitMarginPercentage: Math.round(profitMarginPercentage * 100) / 100,
        productsProfitBreakdown: finalProductsBreakdown,
      },
      inventory: inventoryReport[0] || {
        totalProducts: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0,
        overstockProducts: 0,
      },
      customers: customerDebtReport[0] || {
        totalOutstandingDebt: 0,
        top10CustomersByDebt: [],
      },
      suppliers: supplierReport[0] || {
        totalSuppliers: 0,
        totalOutstandingBalances: 0,
      },
      stockMovement: stockMovementReport[0] || {
        totalStockIN: 0,
        totalStockOUT: 0,
      },
    };
  }
}

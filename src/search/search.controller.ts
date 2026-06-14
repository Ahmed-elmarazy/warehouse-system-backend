// 📄 src/search/search.controller.ts

import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger'; // 👈 استورد دول لو مستخدم Swagger

@ApiTags('Search') // عشان تظهر في سكشن منفصل بالـ Swagger
@Controller('search') // الـ Prefix العالمي api/v1 هيتضاف تلقائي لو متظبط في main.ts
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'البحث الشامل في كل كيانات النظام الـ WMS' })
  async search(@Query() queryDto: SearchQueryDto) {
    // 🚨 حماية إضافية لو الـ Request جه فاضي من أي مكان بره الـ Swagger
    if (!queryDto.q) {
      return {
        success: true,
        message: 'Search query is empty',
        data: {
          products: [],
          customers: [],
          suppliers: [],
          salesInvoices: [],
          purchaseInvoices: [],
          payments: [],
        },
      };
    }

    const searchResults = await this.searchService.globalSearch(queryDto);

    return {
      success: true,
      message: 'Search results retrieved successfully',
      data: searchResults,
    };
  }
}

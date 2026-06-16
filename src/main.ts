import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import type { Express } from 'express';
import helmet from 'helmet';

const SWAGGER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14';

async function createApp(): Promise<Express> {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'error', 'warn', 'debug'],
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.use(helmet());

  // ─── إعداد السواجر بالاسم الأصلي وحقن رابط الـ JSON تحت العنوان ───
  const swaggerConfig = new DocumentBuilder()
    .setTitle('WMS API') // نفس الاسم الأصلي بتاعك
    .setDescription(
      `Warehouse Management System\n\n<a href="/api/v1/docs-json" target="_blank" style="color: #4990e2; text-decoration: none; font-weight: bold;">/api/v1/docs-json</a>`,
    ) // 👈 حقن اللينك التفاعلي هنا ليظهر تحت العنوان مباشرة في السواجر
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // 🛑 ─── إندبوينت لتسليم ملف الـ JSON الفعلي للفرونتد ───
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/v1/docs-json', (req, res) => {
    res.json(document);
  });

  // إعداد شاشة الـ UI العادية
  SwaggerModule.setup('api/v1/docs', app, document, {
    customCssUrl: `${SWAGGER_CDN}/swagger-ui.min.css`,
    customJs: [
      `${SWAGGER_CDN}/swagger-ui-bundle.min.js`,
      `${SWAGGER_CDN}/swagger-ui-standalone-preset.min.js`,
    ],
    swaggerOptions: { persistAuthorization: true },
  });

  await app.init();
  return app.getHttpAdapter().getInstance() as Express;
}

// ─── Local dev ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  createApp().then((expressApp) => {
    const port = process.env.PORT ?? 3000;
    require('http')
      .createServer(expressApp)
      .listen(port, () => {
        console.log(`🚀  API     → http://localhost:${port}/`);
        console.log(`📖  Swagger → http://localhost:${port}/api/v1/docs`);
      });
  });
}

// ─── Vercel handler ────────────────────────────────────────────────────────────
let appPromise: Promise<Express> | null = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = createApp().catch((err) => {
      appPromise = null;
      return Promise.reject(err);
    });
  }
  try {
    const expressApp = await appPromise;
    expressApp(req, res);
  } catch (err) {
    console.error('[Vercel] Bootstrap failed:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ statusCode: 500, message: 'Bootstrap failed' }));
  }
}

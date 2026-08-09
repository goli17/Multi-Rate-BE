import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { MailService } from '../src/mail/mail.service';

describe('Multi-Rate API (e2e)', () => {
  let app: INestApplication<App>;
  let tokenA: string;
  let tokenB: string;

  const sampleLines = [
    {
      description: 'Widget A',
      quantity: 2,
      unitPrice: 100,
      discountType: 'percent',
      discountPercent: 10,
      taxPercent: 5,
    },
    {
      description: 'Widget B',
      quantity: 1,
      unitPrice: 50,
      taxPercent: 5,
    },
    {
      description: 'Service fee',
      quantity: 1,
      unitPrice: 200,
      discountType: 'fixed',
      discountFixed: 20,
      taxPercent: 0,
    },
  ];

  beforeAll(async () => {
    process.env.OTP_FIXED_CODE = '123456';
    process.env.OTP_SKIP_SEND = 'true';
    process.env.SKIP_EMAIL_VERIFICATION = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({ sendOtp: async () => undefined })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const suffix = Date.now();
    async function signupAndVerify(email: string) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ email, password: 'password123' })
        .expect(201);
      const verified = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ email, code: '123456' })
        .expect(201);
      return verified.body.accessToken as string;
    }

    tokenA = await signupAndVerify(`a${suffix}@example.com`);
    tokenB = await signupAndVerify(`b${suffix}@example.com`);
  }, 60000);

  afterAll(async () => {
    if (!app) return;
    const ds = app.get(DataSource);
    await ds.destroy();
    await app.close();
  });

  it('rejects unauthorized document access', async () => {
    await request(app.getHttpServer()).get('/api/v1/documents').expect(401);
  });

  it('creates sample document with correct totals', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Sample',
        customer: 'Acme',
        issueDate: '2026-08-01',
        lineItems: sampleLines,
      })
      .expect(201);

    expect(res.body.subtotal).toBe(450);
    expect(res.body.totalDiscount).toBe(40);
    expect(res.body.totalTax).toBe(11.5);
    expect(res.body.grandTotal).toBe(421.5);
  });

  it('rejects oversized fixed discount', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Bad discount',
        customer: 'Acme',
        issueDate: '2026-08-01',
        lineItems: [
          {
            description: 'Item',
            quantity: 1,
            unitPrice: 50,
            discountType: 'fixed',
            discountFixed: 60,
          },
        ],
      })
      .expect(400);

    expect(String(res.body.message)).toMatch(/exceeds line subtotal/i);
  });

  it('finalizes and blocks edits', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Lock me',
        customer: 'Acme',
        issueDate: '2026-08-02',
        lineItems: sampleLines,
      });

    const id = created.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/documents/${id}/finalize`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/documents/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Nope' })
      .expect(409);
  });

  it('hides other users documents', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Private',
        customer: 'Acme',
        issueDate: '2026-08-03',
        lineItems: [],
      });

    await request(app.getHttpServer())
      .get(`/api/v1/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('returns summary report totals', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Report doc',
        customer: 'Acme',
        issueDate: '2026-08-09',
        lineItems: sampleLines,
      });

    const res = await request(app.getHttpServer())
      .get('/api/v1/reports/summary?from=2026-08-01&to=2026-08-31')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.documentCount).toBeGreaterThanOrEqual(1);
    expect(res.body.sumGrandTotals).toBeGreaterThanOrEqual(421.5);
  });
});

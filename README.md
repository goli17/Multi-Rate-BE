# Multi-Rate Pricing API

NestJS + TypeORM + PostgreSQL backend for the Multi-Rate Pricing Calculator.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm

## Setup

```bash
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET
npm install
npm run start:dev
```

API base URL: `http://localhost:3000/api/v1`

Health: `GET /api/v1/health`

## Environment

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | JWT signing secret |
| `PORT` | Default `3000` |
| `CORS_ORIGIN` | Frontend origin |
| `DATABASE_SSL` | Set `true` for hosted Postgres (Neon, etc.) |
| `NODE_ENV` | `production` disables TypeORM `synchronize` |

## API overview

### Auth
- `POST /auth/signup` `{ email, password }`
- `POST /auth/login` `{ email, password }`

All document/report routes require `Authorization: Bearer <token>`.

### Documents
- `GET /documents`
- `POST /documents`
- `GET /documents/:id`
- `PATCH /documents/:id` (draft only)
- `DELETE /documents/:id` (draft only)
- `POST /documents/:id/finalize`
- `POST /documents/:id/lines`
- `PATCH /documents/:id/lines/:lineId`
- `DELETE /documents/:id/lines/:lineId`

### Reports
- `GET /reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Calculation and rounding policy

- Money is stored as **integer cents**.
- Per line: `subtotal = qty × unitPrice`.
- Apply **either** percent or fixed discount (never both), then tax on the discounted amount.
- Round to the **nearest cent** after discount and after tax on each line.
- Document totals sum the rounded line amounts.

### Worked example (assignment sample)

| Line | Subtotal | Discount | After discount | Tax | Line total |
|---|---:|---:|---:|---:|---:|
| Widget A (2×$100, 10%, 5% tax) | 200.00 | 20.00 | 180.00 | 9.00 | 189.00 |
| Widget B (1×$50, 5% tax) | 50.00 | 0.00 | 50.00 | 2.50 | 52.50 |
| Service fee (1×$200, $20 fixed) | 200.00 | 20.00 | 180.00 | 0.00 | 180.00 |

Document: subtotal **450.00**, discount **40.00**, tax **11.50**, grand total **421.50**.

### Other rules

- Fixed discount greater than line subtotal is **rejected** (not clamped).
- Finalized documents are **immutable** via the API (`409 Conflict`).
- Totals are always computed **server-side**.

## Assumptions and tradeoffs

- Email/password auth with JWT (7-day expiry); no email verification.
- TypeORM `synchronize` is enabled outside production for faster local setup.
- Line `discountValue` stores percent points or fixed cents depending on `discountType`.
- Concurrent draft edits use last-write-wins; finalize runs in a DB transaction.

## Tests

```bash
npm test                 # unit tests (calculations)
npm run test:e2e         # API integration tests (requires DATABASE_URL)
```

## What to improve before production

- Replace `synchronize` with migrations.
- Add refresh tokens / password reset.
- Rate-limit auth endpoints.
- Paginate document lists.
- Snapshot audit log for status changes.
- Deploy with managed Postgres SSL and secrets manager.

## Deployed URL

_Add production API URL here after deploy._

### Suggested deploy

1. Provision Postgres (Neon/Render) and set `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET`, `CORS_ORIGIN`.
2. Deploy this API to Render/Railway (`npm run build` → `npm run start:prod`).
3. Deploy `Multi-Rate-Fe` to Vercel with `VITE_API_URL` pointing at the API `/api/v1`.

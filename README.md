# Multi-Rate Pricing Calculator — API

NestJS + TypeORM + PostgreSQL backend for documents with line-item discounts, tax, draft → finalize lifecycle, and date-range reports.

Companion frontend: `Multi-Rate-Fe`.

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL 14+ (local or hosted, e.g. Neon)

## Setup

```bash
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET, and CORS_ORIGIN
npm install
npm run start:dev
```

API base: `http://localhost:3000/api/v1`  
Health: `GET /api/v1/health`

### Environment

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | JWT signing secret |
| `PORT` | Default `3000` |
| `CORS_ORIGIN` | Comma-separated frontend origins (e.g. `http://localhost:5173,http://localhost:5174`) |
| `DATABASE_SSL` | `true` for hosted Postgres (Neon, etc.) |
| `NODE_ENV` | `production` disables TypeORM `synchronize` |
| `EMAIL_PROVIDER` | `brevo` (HTTPS API, recommended on Render) or `smtp` |
| `BREVO_API_KEY` | Brevo API key (Settings → SMTP & API → API Keys). Prefer this over SMTP on Render. |
| `EMAIL_FROM` | Verified sender address |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Optional SMTP fallback (often blocked on Render) |
| `SKIP_EMAIL_VERIFICATION` | `true` skips OTP (local / until email works). Set `false` in production when email works. |
| `OTP_FIXED_CODE` / `OTP_SKIP_SEND` | Optional local/e2e helpers — never use in production |

## API overview

All document and report routes require `Authorization: Bearer <token>`.

### Auth
- `POST /auth/signup` `{ email, password }` → OTP challenge, or JWT if `SKIP_EMAIL_VERIFICATION=true`
- `POST /auth/verify-otp` `{ email, code }` → JWT
- `POST /auth/resend-otp` `{ email }`
- `POST /auth/login` `{ email, password }` → JWT

### Documents
- `GET /documents`
- `POST /documents`
- `GET /documents/:id`
- `PATCH /documents/:id` — draft only
- `DELETE /documents/:id` — draft only
- `POST /documents/:id/finalize`
- `POST /documents/:id/lines`
- `PATCH /documents/:id/lines/:lineId`
- `DELETE /documents/:id/lines/:lineId`

### Reports
- `GET /reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

Returns `documentCount`, `sumGrandTotals`, `sumTotalTax`, `sumTotalDiscount` for the authenticated user’s documents in the issue-date range.

## Calculation and rounding policy

**Source of truth is the server.** The client only displays amounts returned by the API. Totals are never trusted from the browser.

### Money handling
- Stored and computed as **integer cents** to avoid floating-point drift.
- Convert dollars → cents on input; convert cents → dollars on response.

### Per line (order matters)
1. `subtotal = quantity × unitPrice`
2. Apply **either** a percent discount **or** a fixed discount (never both)
3. Apply tax percent on the **discounted** line amount
4. `lineTotal = afterDiscount + tax`

### Rounding
- Round to the **nearest cent** after the discount step and after the tax step on each line.
- Document totals are the **sum of already-rounded line amounts** (not a re-round of a floating grand total).

### Worked example (assignment sample)

| Line | Subtotal | Discount | After discount | Tax | Line total |
|---|---:|---:|---:|---:|---:|
| Widget A (2×$100, 10%, 5% tax) | 200.00 | 20.00 | 180.00 | 9.00 | 189.00 |
| Widget B (1×$50, 5% tax) | 50.00 | 0.00 | 50.00 | 2.50 | 52.50 |
| Service fee (1×$200, $20 fixed) | 200.00 | 20.00 | 180.00 | 0.00 | 180.00 |

Document: subtotal **450.00**, discount **40.00**, tax **11.50**, grand total **421.50**.

### Validation rules
- Quantity must be an integer ≥ 1; **unit price must be greater than 0**
- Each document stores a **currency** (ISO 4217 codes such as `USD`, `EUR`, `INR`, …); report summary filters by currency
- Percent discount and tax percent must be between **0 and 100** (percent/fixed discount amounts must be &gt; 0 when used)
- Percent and fixed discount cannot both be set on a line
- Fixed discount **greater than** that line’s subtotal is **rejected** (not clamped)
- Invalid input returns **400** with a specific message

## Finalize / immutability

| Status | Behavior |
|---|---|
| `draft` | Fully editable (metadata + lines) |
| `finalized` | Read-only |

- `POST /documents/:id/finalize` moves a draft to finalized (rejects empty documents / invalid lines).
- Any edit, delete, add-line, or second finalize on a finalized document returns **409 Conflict** with a clear message.
- **Duplicate finalized → new draft** is not implemented (optional stretch).

## Assumptions and tradeoffs

- Email OTP via Brevo HTTPS API (preferred) or SMTP. On Render, use `EMAIL_PROVIDER=brevo` + `BREVO_API_KEY` — outbound SMTP often times out. `SKIP_EMAIL_VERIFICATION=true` allows signup/login without OTP until email works.
- TypeORM `synchronize` is on outside production for faster local setup; use migrations before production.
- Line storage uses `discountType` + `discountValue` (percent points or fixed cents).
- Concurrent draft edits are last-write-wins; finalize runs inside a DB transaction.
- Users only see their own documents (ownership enforced by `userId`).

## Tests

```bash
npm test                 # calculation unit tests (highest-value surface)
npm run test:e2e         # API integration tests (requires DATABASE_URL)
```

## What to improve before production

- Replace `synchronize` with versioned migrations
- Turn off `SKIP_EMAIL_VERIFICATION`; set `BREVO_API_KEY` + verified `EMAIL_FROM`
- Refresh tokens / password reset / rate-limit auth
- Paginate document lists; add audit log for finalize
- Deploy with secrets manager and managed Postgres SSL
- Optional: duplicate finalized → draft; printable PDF/HTML view

## Deployed URL

_Add the public frontend URL (and API URL) here after deploy._

### Suggested deploy

1. Provision Postgres (Neon/Render); set `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET`, `CORS_ORIGIN`.
2. Deploy this API (`npm run build` → `npm run start:prod`) to Render/Railway/Fly.
3. Deploy `Multi-Rate-Fe` to Vercel/Netlify with `VITE_API_URL` pointing at `{API}/api/v1`.

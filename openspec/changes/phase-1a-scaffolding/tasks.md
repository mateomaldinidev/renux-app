# Tasks: Phase 1A — Scaffolding

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~445 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full scaffolding — monorepo, DB, auth | PR 1 (single) | All 14 tasks in one PR; ~445 lines within project review budget |

## Phase 1: Root Configuration & Docker

- [x] 1.1 Create `pnpm-workspace.yaml` — packages: `['apps/*']`
- [x] 1.2 Create root `package.json` — workspace scripts, `concurrently` dev dependency
- [x] 1.3 Create `tsconfig.base.json` — strict ESM, path aliases, shared by both apps
- [x] 1.4 Create `biome.json` — lint + format config (Biome, no ESLint/Prettier)
- [x] 1.5 Create `docker-compose.yml` — PostgreSQL 16, port 5432, pgdata volume
- [x] 1.6 Create root `.env.example` — placeholder env vars for DB, JWT, passwords

Dependencies: none (parallel-safe tasks). Verify: `pnpm install` resolves, `docker compose up -d` starts DB.

## Phase 2: API Setup & Database Schema

- [x] 2.1 Create `apps/api/package.json` — deps: hono, drizzle-orm, postgres (postgres.js), drizzle-kit, jsonwebtoken, bcryptjs, zod, @types/bcryptjs, @types/jsonwebtoken, vitest
- [x] 2.2 Create `apps/api/tsconfig.json` — extends `../../tsconfig.base.json`
- [x] 2.3 Create `apps/api/vitest.config.ts` — Vitest config for API tests
- [x] 2.4 Create `apps/api/.env.example` — DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD, DEMO_PASSWORD, PORT
- [x] 2.5 Create `src/config.ts` — Zod schema validates 5 env vars at startup, throws on missing/malformed
- [x] 2.6 Create `src/errors.ts` — `AppError` class with `statusCode` + `message`
- [x] 2.7 Create `src/db/schema.ts` — 9 tables (users, suppliers, products, price_variants, composite_components, purchase_lots, orders, order_lines, expenses) + 3 enums (product_type, unit, order_status)
- [x] 2.8 Create `src/db/index.ts` — Drizzle client instance via postgres.js driver
- [x] 2.9 Create `src/db/seed.ts` — upsert admin + demo users with bcrypt-hashed passwords from env, sample demo data

Dependencies: 1.1–1.5 (root configs), 2.1 (api package.json). Verify: `drizzle-kit generate` produces migration, `drizzle-kit migrate` applies it.

## Phase 3: Auth & Server Entry

- [x] 3.1 Create `src/middleware/error-handler.ts` — catches AppError (status + message), unknown errors → 500 generic
- [x] 3.2 Create `src/middleware/auth.ts` — extract Bearer token, verify JWT, set userId on Hono context
- [x] 3.3 Create `src/schemas/index.ts` — Zod schemas for login request body
- [x] 3.4 Create `src/routes/auth.ts` — POST /login (valid/invalid → 200/401), GET /me (→ { username }), POST /logout (→ 200)
- [x] 3.5 Create `src/index.ts` — Hono app, register error handler + auth middleware, mount auth routes, listen on PORT

Dependencies: Phase 1 + Phase 2 complete (schema must exist for seed, config for env vars). Verify: `pnpm dev:api` starts Hono on :3001; `POST /api/auth/login` with admin creds returns JWT; `GET /api/auth/me` with token returns username; no-token requests return 401.

# Apply Progress: Phase 1A — Scaffolding

**Status:** ✅ Complete
**Date:** 2026-06-27

## Files Created

### Phase 1: Root Configuration & Docker
- [x] `pnpm-workspace.yaml` — packages: `['apps/*']`
- [x] `package.json` — workspace scripts, `concurrently` dev dep
- [x] `tsconfig.base.json` — strict ESM, target ES2024, module NodeNext
- [x] `biome.json` — lint + format config
- [x] `docker-compose.yml` — PostgreSQL 16, port 5432, pgdata volume
- [x] `.env.example` — placeholder env vars

### Phase 2: API Setup & Database
- [x] `apps/api/package.json` — all backend deps
- [x] `apps/api/tsconfig.json` — extends base config
- [x] `apps/api/vitest.config.ts` — Vitest config
- [x] `apps/api/drizzle.config.ts` — Drizzle Kit config
- [x] `apps/api/.env.example` — API env vars
- [x] `apps/api/src/config.ts` — Zod env validation (DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD, DEMO_PASSWORD, PORT)
- [x] `apps/api/src/errors.ts` — AppError class
- [x] `apps/api/src/db/schema.ts` — 9 tables + 3 enums (users, suppliers, products, price_variants, composite_components, purchase_lots, orders, order_lines, expenses)
- [x] `apps/api/src/db/index.ts` — Drizzle client via postgres.js
- [x] `apps/api/src/db/seed.ts` — upsert users + demo sample data

### Phase 3: Auth & Server Entry
- [x] `apps/api/src/middleware/error-handler.ts` — catches AppError + unknown errors
- [x] `apps/api/src/middleware/auth.ts` — JWT verification, userId on context
- [x] `apps/api/src/schemas/index.ts` — Zod schemas for request bodies
- [x] `apps/api/src/routes/auth.ts` — POST /login, GET /me, POST /logout
- [x] `apps/api/src/index.ts` — Hono app, error handler, route mounting, server start

## Commands Executed
- `pnpm install` — all dependencies resolved
- `pnpm dlx drizzle-kit generate` — migration produced
- `pnpm dlx drizzle-kit migrate` — migration applied to PostgreSQL
- `npx tsx src/db/seed.ts` — users and demo data seeded

## Verification
- [x] `POST /api/auth/login` with valid credentials → 200 + JWT
- [x] `POST /api/auth/login` with invalid password → 401 "Invalid credentials"
- [x] `POST /api/auth/login` with unknown user → 401 "Invalid credentials" (no leak)
- [x] `GET /api/auth/me` with valid token → 200 + username
- [x] `GET /api/auth/me` without token → 401 "Authentication required"
- [x] `POST /api/auth/logout` → 200 + success: true
- [x] `GET /api/health` → 200 + status: ok

## Notes
- Uses existing OrbStack PostgreSQL container (renux_db) with credentials `renux`/`renux_password`
- `.env` file excluded from git (in `.gitignore`)
- `drizzle/` migrations directory excluded from git (in `.gitignore`)
- JWT_SECRET uses 32-char string as required by Zod validation

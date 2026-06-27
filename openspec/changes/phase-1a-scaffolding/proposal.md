# Proposal: Phase 1A — Scaffolding

## Intent

Greenfield foundation for RENUX. No code exists — this change establishes the monorepo, database, auth flow, and tooling that every subsequent phase depends on. End state: `POST /api/auth/login` returns a JWT for two seeded users (admin + demo) with multi-tenant data isolation.

## Scope

### In Scope
- Monorepo config: `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `biome.json`
- Docker Compose with PostgreSQL 16
- `apps/api`: Hono server, Drizzle ORM + PostgreSQL connection
- Full schema: 9 tables with `user_id` on products, orders, expenses, purchaseLots (no stockLosses)
- `config.ts`: Zod-validated env vars (DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD, DEMO_PASSWORD, PORT)
- `AppError` class + global error handler middleware
- JWT auth middleware + routes (`POST /login`, `GET /me`, `POST /logout`)
- Seed: admin + demo users, sample data for demo
- Vitest config for API, `.env.example` for both apps

### Out of Scope
- ❌ Frontend code (Phase 3)
- ❌ FIFO service (Phase 1B)
- ❌ Product/purchase/order routes (Phases 1C–1F)
- ❌ Dockerfile (dev-only docker-compose)
- ❌ Integration test database

## Capabilities

### New Capabilities
- `auth`: JWT authentication with login/logout/me endpoints. Two pre-seeded users with identical privileges but multi-tenant data isolation via `user_id` extraction from JWT.
- `database-schema`: Complete PostgreSQL schema (9 tables) via Drizzle ORM. Covers users, suppliers, products with price variants, composite components, purchase lots with FIFO-ready tracking, orders with state machine enums, order lines, and expenses. Multi-tenant on core business tables.

### Modified Capabilities
None — greenfield project.

## Approach

Build in dependency order: monorepo config → DB connection → schema + migration → seed → auth middleware → auth routes → error handler → server entry. Uses `postgres` (postgres.js) as Drizzle driver (native ESM). JWT with 7-day expiry via `jsonwebtoken`, bcryptjs for password hashing. All tooling (Biome, TypeScript strict, Vitest) configured once at root.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| Root configs | New | `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `biome.json` |
| `docker-compose.yml` | New | PostgreSQL 16 on port 5432 |
| `apps/api/` | New | Full backend scaffold (src/, package.json, tsconfig, vitest.config) |
| `openspec/specs/auth/` | Future | Capability spec to be created by sdd-spec |
| `openspec/specs/database-schema/` | Future | Capability spec to be created by sdd-spec |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PostgreSQL not running | High | Docker Compose provides reproducible setup; user must have Docker installed |
| Node 24 vs 22 compatibility | Low | Node 24 backward-compatible; no experimental features |
| Drizzle enum migration | Medium | `pgEnum` handled by drizzle-kit; verify migration generates correctly |

## Rollback Plan

Delete `apps/api/`, root configs, and `docker-compose.yml`. Run `docker compose down -v` to remove PostgreSQL volume. No data to preserve — this is the first code written.

## Dependencies

- Node.js 22+ and pnpm installed (user has 24.15.0 + 11.1.1 ✓)
- Docker Desktop or Docker Engine for PostgreSQL

## Success Criteria

- [ ] `docker compose up -d` starts PostgreSQL 16
- [ ] `pnpm install` installs all workspace dependencies
- [ ] `pnpm drizzle-kit generate` produces migration from schema
- [ ] `pnpm drizzle-kit migrate` applies migration to running DB
- [ ] `pnpm dev:api` starts Hono server on port 3001
- [ ] `POST /api/auth/login` with admin credentials returns `{ token, expiresAt }`
- [ ] `GET /api/auth/me` with valid JWT returns `{ username }`
- [ ] Requests without JWT return 401
- [ ] `pnpm biome check` passes with zero errors
- [ ] TypeScript strict compiles without errors

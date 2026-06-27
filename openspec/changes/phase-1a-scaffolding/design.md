# Design: Phase 1A — Scaffolding

## Technical Approach

Greenfield bootstrap in dependency order: monorepo config → Docker DB → Drizzle schema + migration → seed → auth middleware → auth routes → error handler → Hono entry. Layered architecture: routes delegate to services, services use db client. No frontend code in this phase.

```
Root configs → docker-compose.yml → apps/api/ → Hono entry (index.ts)
                                     ├── config.ts (Zod env)
                                     ├── db/ (schema, client, seed)
                                     ├── middleware/ (auth, error-handler)
                                     ├── routes/ (auth only)
                                     ├── services/ (auth service stub)
                                     ├── errors.ts (AppError)
                                     └── vitest.config.ts
```

## Architecture Decisions

### Decision: postgres.js over pg driver

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `pg` + Drizzle | Mature, C lib dependency | ❌ |
| `postgres` (postgres.js) | Native ESM, no native deps, Drizzle recommended | ✅ |

**Rationale**: Postgres.js is the default Drizzle driver. Pure JS — no native compilation on Docker/macOS/CI. Native ESM aligns with Node 22+ and `"type": "module"`.

### Decision: bcryptjs over bcrypt

**Rationale**: bcryptjs is pure JS. No node-gyp, no Python, no build toolchain. Cross-platform parity (macOS/CI/Docker identical behavior). The ~2x perf difference is irrelevant for login (two users seeding once, ~1 hash per login).

### Decision: serial IDs over UUIDs

**Rationale**: Integer PKs are human-readable for a small business internal tool. Sequential B-tree indexing more efficient than random UUID inserts. Foreign keys stay compact. No distributed-write requirement.

### Decision: JWT in localStorage (not httpOnly cookie)

**Rationale**: RENUX is a single-user-per-session internal tool behind auth, not a public SaaS. No CSRF risk surface (no attacker pages targeting it). Bearer header pattern simpler with TanStack Query `Authorization` injection. Cookie-based JWTs increase complexity with no security gain here.

## Auth Flow

```
LOGIN:
  Client ──POST /api/auth/login { username, password }──▶ auth route
    → db.query.users (WHERE username)
    → bcrypt.compare(password, hash)
    → jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' })
    → { token, expiresAt: now + 7d }

PROTECTED ROUTE:
  Client ──Authorization: Bearer <token>──▶ auth middleware
    → extract token from header
    → jwt.verify(token, JWT_SECRET)
    → ctx.set('userId', payload.userId)
    → (next) → handler uses userId for multi-tenant queries

ERROR PATHS:
  No Authorization header   → 401 { error: "Authentication required" }
  Invalid/expired JWT       → 401 { error: "Invalid or expired token" }
  Wrong password            → 401 { error: "Invalid credentials" }
  Unknown username          → 401 { error: "Invalid credentials" } (no user existence leak)
```

## Database Schema Design

```
┌───────┐       ┌────────────┐        ┌─ products (user_id → users.id) ◄────── composite_components (FIFO 2×)
│ users │──1──N─│ suppliers  │        │   └── price_variants (1:N from products)
└───┬───┘       └────────────┘        ├─ purchase_lots (user_id → users, product_id)
    │  1──N                           ├─ orders (user_id → users) 
    ├──────────── products ◄───────────┤     └── order_lines (1:N from orders, product_id, price_variant_id)
    ├──────────── orders               └─ expenses (user_id → users)
    └──────────── expenses
                                       Tables with user_id: products, orders, expenses, purchase_lots
                                       Tables without: users, suppliers, price_variants, composite_components, order_lines
```

**Enums**: `product_type` (simple | mix | promotion), `unit` (kg | unit), `order_status` (INGRESADO | PREPARADO | ENTREGADO | ADEUDA_PAGO)

## Component / Module Contracts

### AppError (errors.ts)

```typescript
class AppError extends Error {
  statusCode: number          // HTTP status (400, 401, 404, etc.)
  constructor(statusCode: number, message: string)
}
```

### Error handler middleware

Catches all unhandled errors. If `AppError` → responds with `error.statusCode` and `{ error: message }`. Otherwise → 500 with generic message (no stack leak).

### Auth middleware

- Extracts `Authorization: Bearer <token>` header. No token → 401.
- Verifies JWT with `jsonwebtoken`. Invalid/expired → 401.
- Sets `ctx.set('userId', payload.userId)`. Handlers read userId via `ctx.get('userId')`.

### Config module (config.ts)

Zod schema validates at startup: `DATABASE_URL` (string.url), `JWT_SECRET` (string.min(32)), `ADMIN_PASSWORD`, `DEMO_PASSWORD`, `PORT` (coerce.number.default(3001)). Throws on missing/malformed vars.

## Directory Structure

```
Root:
  pnpm-workspace.yaml         ← packages: ['apps/*']
  package.json                ← root scripts (dev, dev:web, dev:api)
  tsconfig.base.json          ← shared strict, ESM, path aliases
  biome.json                  ← lint + format config
  docker-compose.yml          ← PostgreSQL 16, port 5432, volume pgdata
  .env.example

apps/api/
  package.json                ← deps: hono, drizzle-orm, postgres, jsonwebtoken, bcryptjs, zod
  tsconfig.json               ← extends ../../tsconfig.base.json
  vitest.config.ts
  .env.example
  src/
    index.ts                  ← Hono app, mount routes, start server
    config.ts                 ← Zod env validation
    errors.ts                 ← AppError class
    db/
      schema.ts               ← 9 tables + 3 enums (Drizzle definitions)
      index.ts                ← drizzle(client) instance
      seed.ts                 ← admin + demo users + demo sample data
    middleware/
      auth.ts                 ← JWT verification, attaches userId
      error-handler.ts        ← Catches AppError + unknown errors
    routes/
      auth.ts                 ← POST /login, GET /me, POST /logout
    schemas/
      index.ts                ← Zod schemas for request bodies
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `AppError` constructor, config validation, auth middleware JWT verify/401 | Vitest, mock `c.env` / `ctx` |
| Integration | `POST /api/auth/login` (valid + invalid credentials), `GET /api/auth/me` (valid + expired token) | Vitest against test DB or mocked Drizzle |

No E2E yet (Playwright planned for Phase 3). Vitest configured but no tests written in this phase.

## Migration / Rollout

First code ever written. `docker compose up -d` → `drizzle-kit migrate` → `pnpm dev:api`. Rollback: `docker compose down -v`, delete `apps/api/` and root configs.

## Open Questions

- None. All decisions resolved in AGENTS.md and proposal.

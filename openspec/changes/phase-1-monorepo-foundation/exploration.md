## Exploration: Phase 1 — Monorepo Foundation

### Current State

Completely greenfield. The repo contains only `AGENTS.md`, `openspec/config.yaml`, and `.atl/skill-registry.md`. No code, no package.json, no config files, no database.

Environment: Node v24.15.0, pnpm 11.1.1. PostgreSQL is **not installed** — needs Docker or Homebrew setup before any DB work can happen.

### Affected Areas

This change creates everything from scratch. Key areas:

- **Root** — `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.env.example`
- **apps/api/** — Hono server, Drizzle ORM, schema, seed, auth, error handling, FIFO service
- **apps/web/** — NOT in scope for this change (Phase 2)
- **Database** — PostgreSQL schema with 10 tables (after removing `stock_losses`)

### Analysis: Build Ordering

**AGENTS.md prescribes backend-first (Phase 1 steps 1-15, then Phase 2 frontend).** After analysis, this is correct for RENUX, with one refinement.

#### Why backend-first wins here:

1. **FIFO is the highest-risk logic** — it's pure backend, purely testable, and everything else (orders, dashboard, stock) depends on it being correct
2. **Schema is the foundation** — frontend can't be built without knowing the API shape
3. **Auth must work before any protected route** — frontend needs a working `/api/auth/login` to validate the full stack
4. **No UI dependencies** — the business owner uses this while preparing orders; the API can be tested with curl/HTTPie before any React code exists

#### The refinement: thin vertical validation after auth

After monorepo + DB + auth are working (steps 1-6), add a **smoke test** that exercises the full request cycle: `POST /api/auth/login` → get JWT → `GET /api/products` with auth header. This validates middleware, DB connection, and error handling before building domain logic.

### Analysis: First Change Scope

**AGENTS.md Phase 1 steps 1-9 as a single SDD change is too large.** Here's why:

| Step | Files | Est. Lines | Risk |
|------|-------|-----------|------|
| 1. Monorepo setup | 5 config files | ~120 | Low |
| 2. Hono + Drizzle setup | 3 files | ~80 | Low |
| 3. Schema | 1 file | ~180 | Medium |
| 4. Seed | 1 file | ~25 | Low |
| 5. AppError | 1 file | ~20 | Low |
| 6. Auth middleware | 1 file | ~40 | Low |
| 7. FIFO service + tests | 2 files | ~250 | **High** |
| 8. Stock service | 1 file | ~100 | Medium |
| 9. Auth routes | 1 file | ~60 | Low |

**Total: ~875 lines across ~16 files.** Under the 1500-line PR limit, but the FIFO service (step 7) is a complexity spike in the middle of otherwise mechanical scaffolding. If FIFO needs iteration, the entire foundation change gets blocked.

#### Recommended split into two SDD changes:

**Change 1: `phase-1a-scaffolding`** (steps 1-6 + 9)
- Monorepo config, Hono server, Drizzle, schema, seed, auth middleware, auth routes, error handler
- ~445 lines, all low risk, mechanical
- Ends with: `POST /api/auth/login` works and returns a JWT
- **This is the recommended FIRST change**

**Change 2: `phase-1b-domain-logic`** (steps 7-8)
- FIFO service with comprehensive tests, stock service
- ~350 lines, high risk (FIFO), but isolated and testable
- Ends with: FIFO service fully tested, stock queries working
- **Depends on Change 1 being complete**

This split means:
- Scaffolding can be reviewed and merged fast (low cognitive load)
- FIFO gets its own focused review with test coverage as the acceptance criteria
- If FIFO needs rework, it doesn't block the scaffolding

### Analysis: Dependencies & Critical Path

```
Monorepo config
    ↓
Hono + Drizzle + DB connection
    ↓
Schema + migrations
    ↓
Seed (user)
    ↓
Auth middleware + Auth routes ← FIRST VALIDATABLE MILESTONE
    ↓
FIFO service + tests ← HIGHEST RISK
    ↓
Stock service
    ↓
Products + Purchases routes
    ↓
Order service + routes ← MOST COMPLEX TRANSACTION
    ↓
Expenses + Dashboard
```

**Critical path**: Monorepo → Schema → Auth → FIFO → Stock → Products → Orders

Nothing can start until monorepo config exists. Auth must work before any protected route can be tested. FIFO must be correct before orders can be built.

### Analysis: Schema Adjustments

AGENTS.md section 9 defines 11 tables. One confirmed removal:

| Change | Table | Reason |
|--------|-------|--------|
| **REMOVE** | `stock_losses` | User removed merma feature from scope |

**All other tables confirmed correct.** Minor observations (not changes):

- `purchaseLots` uses `purchasedAt` as both creation timestamp and business date — this is fine, no separate `createdAt` needed
- `priceVariants.offerPrice` is nullable (null = no offer) — clean design
- `compositeComponents` serves both mixes and promotions — good reuse, single table
- `orders.totalCost` is stored (not computed) — correct for historical accuracy since FIFO costs are point-in-time
- Numeric precision (10,3 for quantities, 10,2 for prices) — appropriate for a food business selling by weight

### Analysis: Project Structure

The proposed structure from AGENTS.md section 11 is **correct and should be followed exactly**:

```
apps/api/src/
├── index.ts              ← Hono app, middleware mounting
├── db/
│   ├── schema.ts         ← All Drizzle table definitions
│   ├── index.ts          ← Drizzle client instance
│   └── seed.ts           ← Admin user seed
├── middleware/
│   ├── auth.ts           ← JWT verification
│   └── error-handler.ts  ← Global error handler
├── routes/               ← One file per resource
├── services/             ← Business logic (FIFO, orders, stock, dashboard)
├── schemas/
│   └── index.ts          ← Zod schemas (shared with frontend later)
└── errors.ts             ← AppError class
```

One addition: add `apps/api/src/config.ts` for environment variable validation (use Zod to parse `process.env` at startup — fail fast if `DATABASE_URL` or `JWT_SECRET` are missing).

### Analysis: Testing Strategy

**Vitest setup is part of Change 1 (scaffolding).** Configuration:

```
apps/api/
├── vitest.config.ts      ← Vitest config for API
├── src/
│   └── services/
│       ├── fifo.service.ts
│       └── __tests__/
│           └── fifo.service.test.ts
```

**FIFO test matrix** (Change 2):

| Scenario | Input | Expected |
|----------|-------|----------|
| Single lot, sufficient | 1 lot × 10kg, need 3kg | 1 consumption, cost = 3 × unitCost |
| Multiple lots, FIFO order | 3 lots (oldest first), need 5kg | Consumes lot 1 fully, then lot 2 partially |
| Exact match | Lots total exactly what's needed | sufficient=true, shortfall=0 |
| Insufficient stock | Need 10kg, only 7kg available | sufficient=false, shortfall=3 |
| Empty lots | No lots exist | sufficient=false, shortfall=full amount |
| Zero quantity needed | Need 0 | Edge case: return empty consumptions, sufficient=true |
| Composite product | Mix with 2 components | Independent FIFO per component |
| Partial composite failure | Component A sufficient, B insufficient | sufficient=false, error lists only B |

**Integration tests** (later, not in Phase 1): Use `msw` or direct HTTP testing with a test database.

### Approaches

1. **Single large change (steps 1-9)** — everything in one PR
   - Pros: One review cycle, faster to "done"
   - Cons: FIFO rework blocks scaffolding review, ~875 lines mixed risk levels
   - Effort: Medium

2. **Two-change split (recommended)** — scaffolding first, domain logic second
   - Pros: Clean separation, fast scaffolding merge, focused FIFO review
   - Cons: Two review cycles, state.yaml overhead
   - Effort: Low + High (split appropriately)

3. **Vertical slice** — thin end-to-end (auth + one product CRUD) before FIFO
   - Pros: Validates full stack early
   - Cons: Requires partial FIFO or mocking for order tests, adds complexity
   - Effort: High

### Recommendation

**Approach 2: Two-change split.** Start with `phase-1a-scaffolding` as the first SDD change.

This change covers AGENTS.md steps 1-6 + 9:
1. pnpm workspace, root configs (Biome, tsconfig, env example)
2. `apps/api` Hono server with basic health check
3. Drizzle ORM setup + PostgreSQL connection
4. Full schema (minus `stock_losses`) + migration generation
5. Seed script for admin user
6. `AppError` class + global error handler middleware
7. JWT auth middleware + auth routes (login, logout, me)

**End state**: A running API server where you can `POST /api/auth/login` and get a JWT, and `GET /api/auth/me` validates it. Database is migrated and seeded. All tooling (Biome, TypeScript, Vitest) is configured.

**Then**: `phase-1b-domain-logic` covers FIFO service + tests + stock service.

### Risks

- **PostgreSQL not installed** — user needs to set up PostgreSQL (Docker recommended: `docker run --name renumx-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:16`). This blocks all DB work.
- **Node 24 vs 22** — AGENTS.md says Node 22+, user has Node 24. Should be compatible but worth noting.
- **Drizzle + PostgreSQL driver** — need to choose between `pg`, `postgres` (postgres.js), or `@vercel/postgres`. Recommendation: use `postgres` (postgres.js) — it's what Drizzle recommends for Node, has native ESM support, and works well with Hono.
- **FIFO numeric precision** — using `numeric(10,3)` in DB but JavaScript `number` in service layer. For a food business with kg quantities, this is fine (no currency-level precision issues), but the FIFO service should use `parseFloat()` carefully and document the precision assumptions.

### Ready for Proposal

**Yes.** The orchestrator should proceed to `sdd-propose` for `phase-1a-scaffolding`. The scope is well-defined, low-risk, and mechanical. The proposal should cover:

- Monorepo setup with pnpm workspace
- Hono + Drizzle + PostgreSQL connection
- Full schema definition (10 tables, no stock_losses)
- Seed script
- Auth flow (JWT middleware + routes)
- Error handling
- Biome + TypeScript + Vitest configuration
- Environment variable validation

The user should confirm PostgreSQL availability before implementation begins.

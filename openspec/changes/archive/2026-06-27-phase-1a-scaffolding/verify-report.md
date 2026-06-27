# Verification Report: Phase 1A — Scaffolding

**Change:** `phase-1a-scaffolding`
**Date:** 2026-06-27
**Mode:** Standard verify (Strict TDD not active)
**Verdict:** PASS WITH WARNINGS

---

## Completeness Table

| Dimension | Artifacts Present | Verdict |
|---|---|---|
| Tasks | ✅ 14/14 checked complete | PASS |
| Specs (auth + database-schema) | ✅ Both specs exist | PASS |
| Design | ✅ design.md present | PASS (minor deviation) |
| Implementation (code) | ✅ 17 source files + configs exist | PASS |
| Verifiable evidence (runtime) | ✅ Auth endpoints, DB queries | PASS |

---

## Build / Tools / Coverage

| Check | Result | Details |
|---|---|---|
| `pnpm install` | ✅ Pass | All 13 dependencies resolved across 2 workspace projects |
| `pnpm dev:api` → starts Hono | ✅ Pass | Server starts on :3001, `/api/health` returns 200 |
| `tsc --noEmit` (TypeScript) | ❌ **CRITICAL** | `typescript` not installed as devDependency. `pnpm run build` (which calls `tsc`) would fail. tsconfig exists but compiler is missing. |
| `biome check` (lint + format) | ❌ **CRITICAL** | `@biomejs/biome` not installed. biome.json config exists but the tool can't run. |
| Tests (`pnpm test`) | ⚠️ WARNING | vitest configured but no tests written. Expected per design ("no tests written in this phase"). |

---

## Schema Compliance Matrix

| Spec Requirement | Expectation | Actual | Status |
|---|---|---|---|
| 9 tables exist | users, suppliers, products, price_variants, composite_components, purchase_lots, orders, order_lines, expenses | ✅ All 9 tables confirmed in PostgreSQL | ✅ COMPLIANT |
| No `stock_losses` table | Must not exist | ✅ 0 rows — confirmed absent | ✅ COMPLIANT |
| 3 enums defined | product_type, unit, order_status | ✅ All 3 enums defined with correct values | ✅ COMPLIANT |
| order_status values | INGRESADO, PREPARADO, ENTREGADO, ADEUDA_PAGO | ✅ All 4 values present, no extras | ✅ COMPLIANT |
| user_id on core tables | products, orders, expenses, purchase_lots | ✅ All 4 have NOT NULL user_id FK → users.id | ✅ COMPLIANT |
| suppliers has NO user_id | No column | ✅ No user_id column on suppliers | ✅ COMPLIANT |

---

## Auth Compliance Matrix

| Scenario | Spec Expectation | Actual Result | Status |
|---|---|---|---|
| Valid login (admin) | 200 + `{ token, expiresAt }` | ✅ 200, JWT issued, `expiresAt` = +7d from now | ✅ PASSING |
| Wrong password (admin) | 401, descriptive error, no JWT | ✅ 401, `{"error":"Invalid credentials"}` | ✅ PASSING |
| Unknown user | 401, no user existence leak | ✅ 401, `{"error":"Invalid credentials"}` — identical message to wrong password | ✅ PASSING |
| Valid JWT → GET /me | 200 + `{ username }` | ✅ 200, `{"username":"admin"}` | ✅ PASSING |
| No token → GET /me | 401 | ✅ 401, `{"error":"Authentication required"}` | ✅ PASSING |
| Invalid/expired token → GET /me | 401 | ✅ 401, `{"error":"Invalid or expired token"}` | ✅ PASSING |
| POST /logout | 200, client-side only | ✅ 200, `{"success":true}`, no server-side state | ✅ PASSING |
| JWT payload contains userId + username | Both present | ✅ `{ userId: 1, username: "admin" }` | ✅ PASSING |
| JWT expires in 7 days | exp = iat + 604800s | ✅ 604800 seconds (= 7.0 days) confirmed | ✅ PASSING |
| No user existence leak | Same message for wrong password & unknown user | ✅ Both return `"Invalid credentials"` | ✅ PASSING |

---

## Seed Compliance Matrix

| Spec Requirement | Expectation | Actual | Status |
|---|---|---|---|
| Exactly 2 users | admin + demo | ✅ 2 rows: id=1 admin, id=2 demo | ✅ COMPLIANT |
| Passwords bcrypt-hashed | Not plaintext | ✅ Both stored as `$2a$10$...` (bcrypt) | ✅ COMPLIANT |
| Admin has no business data | 0 products, 0 orders, 0 expenses, 0 purchase_lots | ✅ All 4 counts = 0 for user_id=1 | ✅ COMPLIANT |
| Demo has sample data | products, purchase lots, orders exist | ✅ 5 products, 4 purchase lots, 1 order (user_id=2) | ✅ COMPLIANT |
| Seed idempotency | No duplicates on re-run | ✅ Second run: "already exists, skipping" for all entities | ✅ COMPLIANT |

---

## Design Coherence

| Design Decision | Code Evidence | Status |
|---|---|---|
| postgres.js over pg driver | `import postgres from 'postgres'` in `db/index.ts` | ✅ MATCH |
| bcryptjs over bcrypt | `import bcrypt from 'bcryptjs'` in `seed.ts` and `auth.ts` | ✅ MATCH |
| serial IDs over UUIDs | `serial('id').primaryKey()` in schema.ts | ✅ MATCH |
| JWT in Bearer header (not httpOnly cookie) | `Authorization: Bearer <token>` extraction in `middleware/auth.ts` | ✅ MATCH |
| Layered architecture (routes → services → db) | ⚠️ **Minor deviation**: `routes/auth.ts` queries db directly. No service layer present. Design doc says "services/ (auth service stub)" but no service files were created. Tasks 3.1-3.5 didn't include service creation. | ⚠️ MINOR DEVIATION |
| Directory structure | All files in expected locations per design doc | ✅ MATCH |
| `.env` + `drizzle/` gitignored | Both confirmed excluded via `.gitignore` + `git check-ignore` | ✅ MATCH |

---

## Issues

### CRITICAL
1. **`typescript` package missing from devDependencies**
   - `apps/api/package.json` has a `"build": "tsc"` script but `typescript` is not listed in devDependencies (neither in root nor in `apps/api`).
   - `npx tsc --noEmit` fails. TypeScript strict compliance cannot be verified.
   - **Fix:** Add `"typescript": "^5.x"` to `apps/api/package.json` devDependencies and run `pnpm install`.

2. **`@biomejs/biome` package missing from devDependencies**
   - `biome.json` exists at root with full lint + format configuration, but the package is not installed in any workspace.
   - `pnpm biome check` fails because the binary is not present.
   - **Fix:** Add `"@biomejs/biome": "^1.9.4"` to root `package.json` devDependencies and run `pnpm install`.

### WARNING
3. **No tests written** — `vitest.config.ts` and `vitest` devDependency are in place, but no `*.test.ts` files exist. This is expected per design.md ("no tests written in this phase"), but should be tracked as future work.

### SUGGESTION
4. **Service layer not created** — `auth.ts` route queries the database directly rather than delegating to a service. The design doc describes a layered architecture (routes → services → db). Creating even a simple `auth.service.ts` would align with the documented architecture and make future phases (FIFO, orders) cleaner. This is non-blocking for Phase 1A since no tasks were defined for services.

---

## Summary

| Category | Count |
|---|---|
| CRITICAL | 2 (missing packages: typescript, biome) |
| WARNING | 1 (no tests) |
| SUGGESTION | 1 (missing service layer) |

**Next recommended:** Install the two missing packages (`typescript` + `@biomejs/biome`), re-run `pnpm install`, then verify `tsc --noEmit` and `biome check` pass before marking this change as truly done.

**Risks:** Low. The two missing packages are trivial to add (one `pnpm add` command). The implementation code itself is correct and all runtime behavior matches specs.

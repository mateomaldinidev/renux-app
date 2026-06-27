# Tasks: Phase 1B — FIFO + Stock

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~175 (40+100+35) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | FIFO engine (tests + impl) | PR 1 | Pure function, no DB; creates `services/` dir |
| 2 | Stock queries + tests | PR 1 | Read-only Drizzle; same PR — small scope |

## Phase 1: TDD Scaffold (RED)

- [x] 1.1 Create `apps/api/src/services/` directory
- [x] 1.2 Write `apps/api/src/services/fifo.service.test.ts` with 8 scenarios: single-lot exact, single-lot partial, two-lot split, exact-first-lot, insufficient, empty lots, zero qty, weighted-average — all FAIL (no impl yet)

## Phase 2: FIFO Implementation (GREEN)

- [x] 2.1 Implement `calculateFifo()` in `apps/api/src/services/fifo.service.ts` with types `FifoConsumption`, `FifoResult`, `LotInput` — stateless, no DB, no mutation
- [x] 2.2 Run `pnpm vitest run` — confirm all 8 scenarios pass (9 total incl. immutability)

## Phase 3: Stock Query Service

- [x] 3.1 Implement `getProductStock(productId, userId)` in `apps/api/src/services/stock.service.ts` — Drizzle query with `eq(userId)`, `eq(productId)`, `gt(quantityLeft, '0')`, `orderBy(purchasedAt ASC)`, numeric cast
- [x] 3.2 Implement `getStockForProducts(productIds[], userId)` — batch `inArray()` query, `Map<number, StockResult>` grouping, zero-stock fallback for products with no lots
- [x] 3.3 Run `pnpm biome check apps/api/src/services/` — zero errors

## Phase 4: Stock Service Tests (conditional)

- [x] 4.1 Write `apps/api/src/services/stock.service.test.ts` — 10 tests covering happy path, empty lots, batch aggregation, zero-stock fallback, tenant isolation, chronological ordering (mocked `db.select()`)

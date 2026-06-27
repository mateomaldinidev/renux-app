# Proposal: Phase 1B — FIFO + Stock

## Intent

Build the system's most critical module: the FIFO cost calculation engine and stock query service. Every peso of profit shown on the dashboard depends on this logic being correct. Phase 1A delivered the schema and auth; this phase makes `purchase_lots` useful by teaching the system how to consume them chronologically.

## Scope

### In Scope
- `calculateFifo()` — pure function, zero DB dependencies, fully unit-testable
- 8+ Vitest unit tests covering single-lot, multi-lot, exact-match, insufficient, empty, zero-qty, weighted-average, and exact-first-lot scenarios
- `getProductStock(productId)` — returns `{ totalStock, lots[] }` ordered by `purchasedAt ASC`, filtered by `userId`
- `getStockForProducts(productIds[])` — batch query, same ordering and isolation

### Out of Scope
- Order creation and DB write operations (Phase 1E)
- Product/purchase HTTP routes (Phase 1C)
- Composite product resolution (FIFO handles flats lots only; caller resolves components)

## Capabilities

### New Capabilities
- `fifo-engine`: Pure `calculateFifo()` function that consumes pre-sorted purchase lots oldest-first. Never mutates input. Returns consumptions with weighted-average cost, sufficiency flag, and shortfall amount.
- `stock-queries`: Read-only Drizzle queries for product stock. Aggregates `quantityLeft` from `purchase_lots`, returns lots ordered by `purchasedAt ASC`. All queries filtered by `userId`.

### Modified Capabilities
None — `database-schema` (from Phase 1A) already defines `purchase_lots` with `userId`, `quantityLeft`, `unitCost`, and `purchasedAt`.

## Approach

Two pure modules with no interdependency:

1. **`fifo.service.ts`** — Accepts pre-sorted lots `{ id, quantityLeft, unitCost }[]` and a `quantityNeeded`. Returns `FifoConsumption[]` + `totalCost` + `averageUnitCost` + `sufficient` + `shortfall`. Stateless; no DB access. Tests written first (TDD).

2. **`stock.service.ts`** — Two Drizzle query functions using the existing `db` client and `purchaseLots` table. Both accept `userId` parameter. Both order by `purchasedAt ASC` (prerequisite for `calculateFifo`).

Files created in `apps/api/src/services/` (directory does not yet exist). Tests in `apps/api/src/__tests__/`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/services/fifo.service.ts` | New | Pure FIFO calculation (~80 lines) |
| `apps/api/src/services/stock.service.ts` | New | Stock query functions (~50 lines) |
| `apps/api/src/__tests__/fifo.service.test.ts` | New | 8+ scenarios (~120 lines) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| FIFO edge case not covered | Medium | 8+ test scenarios explicitly enumerated; TDD approach |
| Drizzle numeric type mismatch in tests | Low | Tests use plain numbers; `calculateFifo` is DB-agnostic |
| `typescript` / `@biomejs/biome` still missing | High | Must install both before writing tests (carryover from 1A verify) |

## Rollback Plan

Delete `apps/api/src/services/` and `apps/api/src/__tests__/fifo.service.test.ts`. No DB migrations, no route changes — pure file removal.

## Dependencies

- Phase 1A must be functional (DB running, schema migrated, seed executed)
- `typescript` and `@biomejs/biome` packages MUST be installed (fix Phase 1A CRITICAL issues first)

## Success Criteria

- [ ] `calculateFifo()` passes all 8+ test scenarios
- [ ] `getProductStock(id)` returns correctly aggregated `totalStock` and sorted lots
- [ ] All queries filter by `userId` — data isolation intact
- [ ] `pnpm biome check` passes with zero errors
- [ ] `pnpm vitest run` passes all tests

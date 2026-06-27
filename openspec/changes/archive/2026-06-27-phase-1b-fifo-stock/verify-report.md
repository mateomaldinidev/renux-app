# Verification Report: Phase 1B — FIFO + Stock

## Change

| Field | Value |
|-------|-------|
| Change ID | `phase-1b-fifo-stock` |
| Description | FIFO cost calculation engine + stock query service |
| Phase | 1B — Backend |
| Verification date | 2026-06-27 |
| Change root | `openspec/changes/phase-1b-fifo-stock/` |

## Artifact Availability

| Artifact | Present | Path |
|----------|---------|------|
| Proposal | ✅ | `proposal.md` |
| Delta specs | ✅ | `openspec/specs/fifo-engine/spec.md`, `openspec/specs/stock-queries/spec.md` |
| Design | ✅ | `design.md` |
| Tasks | ✅ | `tasks.md` |
| Apply progress | ✅ | `apply-progress.md` |

## Task Completion

| # | Task | Status |
|---|------|--------|
| 1.1 | Create `apps/api/src/services/` directory | ✅ Complete |
| 1.2 | Write `fifo.service.test.ts` with 8 scenarios | ✅ Complete (9 tests) |
| 2.1 | Implement `calculateFifo()` in `fifo.service.ts` | ✅ Complete |
| 2.2 | Run `pnpm vitest run` — all scenarios pass | ✅ 9/9 passed |
| 3.1 | Implement `getProductStock()` in `stock.service.ts` | ✅ Complete |
| 3.2 | Implement `getStockForProducts()` in `stock.service.ts` | ✅ Complete |
| 3.3 | Run `pnpm biome check apps/api/src/services/` | ✅ Clean |
| 4.1 | Write `stock.service.test.ts` (10 tests) | ✅ Complete |

**Task completeness**: 8/8 complete. No unchecked tasks. ✅

## Build, Test, and Coverage Evidence

| Command | Result | Details |
|---------|--------|---------|
| `cd apps/api && pnpm vitest run` | ✅ PASS | 2 files, 19 tests (9 FIFO + 10 stock), 0 failures, 297ms |
| `pnpm --filter api exec biome check` | ✅ PASS | 18 files checked, 0 errors, 0 warnings, 6ms |
| `cd apps/api && npx tsc --noEmit` | ✅ PASS | No output = clean compilation |

## Spec Compliance Matrix: fifo-engine

| # | Requirement | Scenario | Test | Status |
|---|------------|----------|------|--------|
| 1 | calculateFifo Function Signature | Return shape contract | All 9 tests verify return fields | ✅ COMPLIANT |
| 2 | Single Lot Partial Consumption | Partial use of one lot | "consumes partial quantity from a single lot" | ✅ COMPLIANT |
| 3 | FIFO Ordering Across Multiple Lots | Two lots, split consumption | "consumes oldest lot first when spanning multiple lots" | ✅ COMPLIANT |
| 4 | Weighted Average Cost | Average reflects mix of unit costs | "calculates weighted average cost across multiple lots" | ✅ COMPLIANT |
| 5 | Exact Match Sufficiency | Demand equals supply | "consumes exact quantity from a single lot" | ✅ COMPLIANT |
| 6 | Insufficient Stock | Demand exceeds supply | "returns sufficient=false and correct shortfall when stock is insufficient" | ✅ COMPLIANT |
| 7 | Empty Lots | No lots available | "handles empty lots array" | ✅ COMPLIANT |
| 8 | Zero Quantity Requested | Zero demand | "handles zero quantity needed" | ✅ COMPLIANT |
| 9 | Input Immutability | Caller lots unchanged | "does not mutate input lots array or lot objects" | ✅ COMPLIANT |

**fifo-engine verdict**: 9/9 requirements COMPLIANT with runtime test evidence. ✅

## Spec Compliance Matrix: stock-queries

| # | Requirement | Scenario | Test | Status |
|---|------------|----------|------|--------|
| 1 | getProductStock Query | Happy path aggregation | "returns totalStock and lots for a product with multiple lots" | ✅ COMPLIANT |
| 2 | Product with no lots | Product with no lots for user | "returns totalStock=0 and empty lots for product with no lots" | ✅ COMPLIANT |
| 3 | Lots Ordered By purchasedAt ASC | Chronological ordering | "orders lots by purchasedAt ASC" | ✅ COMPLIANT |
| 4 | Multi-Tenant Isolation | Cross-user data hidden | "filters by both userId and productId" + batch isolation test | ✅ COMPLIANT |
| 5 | getStockForProducts Batch Query | Batch aggregation over multiple products | "returns a Map with stock for multiple products" | ✅ COMPLIANT |
| 6 | Batch query respects tenant isolation | Tenant filter applied to batch | "respects tenant isolation — only queries for the given userId" | ✅ COMPLIANT |
| 7 | Empty Result For Unknown Product | Unknown product id in batch | "returns zero-stock fallback for products with no lots" + mixed results test | ✅ COMPLIANT |
| * | Exclusion Of Other Users Affects totals | Tenant filter applied to sum | Covered by multi-tenant isolation tests | ✅ COMPLIANT |

**stock-queries verdict**: 7/7 requirements COMPLIANT with runtime test evidence. ✅

## Design Coherence

| Decision | Design Spec | Implementation | Status |
|----------|-------------|----------------|--------|
| Co-located test files (`*.test.ts`) | Same directory as source | `apps/api/src/services/fifo.service.test.ts`, `stock.service.test.ts` | ✅ MATCH |
| Drizzle numeric → JS Number | Convert in stock service, pass `number` to FIFO | `Number(row.quantityLeft)`, `Number(row.unitCost)` | ✅ MATCH |
| `getStockForProducts` returns Map | `Map<number, StockResult>` | `Map<number, StockResult>` | ✅ MATCH |
| FIFO algorithm | Loop, consume oldest-first, immutability | Identical to design pseudo-code | ✅ MATCH |
| Empty lots filter (`gt(quantityLeft, '0')`) | Exclude exhausted lots | `gt(purchaseLots.quantityLeft, '0')` in both queries | ✅ MATCH |
| Interfaces/contracts | `FifoConsumption`, `FifoResult`, `LotInput`, `LotDto`, `StockResult` | All types match design | ✅ MATCH |

**Design coherence**: No deviations. All architectural decisions faithfully implemented. ✅

## Issues

### CRITICAL
None.

### WARNING
None.

### SUGGESTION
- **Monetary precision rounding**: The `averageUnitCost` field is computed as raw division (`totalCost / totalConsumed`) without explicit rounding to 2 decimal places. The design explicitly chose IEEE 754 double for this range, which is adequate. Future callers handling `averageUnitCost` for display should apply `Number.toFixed(2)` at the presentation layer.

## Verdict

**PASS** ✅

All tasks complete. All 16 spec requirements verified with passing runtime test evidence. Design faithfully implemented with zero deviations. Biome clean, TypeScript strict mode passing. No CRITICAL or WARNING issues. Ready for archive.

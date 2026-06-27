# Archive Report: Phase 1B — FIFO + Stock

## Summary

| Field | Value |
|-------|-------|
| Change ID | `phase-1b-fifo-stock` |
| Phase | 1B — Backend |
| Verification | PASS ✅ |
| Archive date | 2026-06-27 |
| Archived to | `openspec/changes/archive/2026-06-27-phase-1b-fifo-stock/` |

## What Was Built

Two independent modules forming the foundation of the system's cost accounting:

1. **`fifo.service.ts`** — Pure, stateless `calculateFifo()` function that consumes pre-sorted purchase lots oldest-first. Returns detailed per-lot consumptions, weighted-average cost, sufficiency flag, and precise shortfall. Zero DB dependencies. 67 lines.

2. **`stock.service.ts`** — `getProductStock()` and `getStockForProducts()` Drizzle query functions. Aggregate `purchase_lots` by product with multi-tenant isolation, chronological ordering, and numeric-to-JS-number conversion. Return shape feeds directly into `calculateFifo()`. 129 lines.

## Capabilities Delivered

| Capability | Status | Spec |
|-----------|--------|------|
| `fifo-engine` | ✅ COMPLIANT | `openspec/specs/fifo-engine/spec.md` (9 requirements) |
| `stock-queries` | ✅ COMPLIANT | `openspec/specs/stock-queries/spec.md` (7 requirements) |

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `apps/api/src/services/fifo.service.ts` | Created | 67 |
| `apps/api/src/services/fifo.service.test.ts` | Created | 128 |
| `apps/api/src/services/stock.service.ts` | Created | 129 |
| `apps/api/src/services/stock.service.test.ts` | Created | 195 |

**Total**: 4 files, ~519 lines.

## Verification Evidence

| Gate | Result |
|------|--------|
| Unit tests (Vitest) | 19/19 passed (9 FIFO + 10 stock) |
| Lint/format (Biome) | 0 errors, 0 warnings |
| TypeScript (strict) | Clean — `tsc --noEmit` passed |
| Spec compliance (fifo-engine) | 9/9 requirements COMPLIANT |
| Spec compliance (stock-queries) | 7/7 requirements COMPLIANT |
| Design coherence | All decisions faithfully implemented |
| Task completeness | 8/8 tasks complete |

## Issues Resolved
None — clean verification with zero CRITICAL or WARNING issues.

## Notes for Future Phases

- **Phase 1E (Order Creation)** will consume both services: `getStockForProducts()` to fetch pre-sorted lots, `calculateFifo()` to compute costs and validate sufficiency per product.
- `averageUnitCost` is a raw float — presentation-layer rounding (`.toFixed(2)`) is the caller's responsibility.
- `getStockForProducts` filters out zero-quantity lots (`gt(quantityLeft, '0')`) — fully consumed lots are invisible to the stock layer, which is correct for FIFO.

## Rollback Instructions
Delete `apps/api/src/services/` directory and its four files. No DB migrations, no route changes. Pure file removal.

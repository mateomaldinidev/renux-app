# Design: Phase 1B — FIFO + Stock

## Technical Approach

Two independent modules with zero interdependency: a pure FIFO calculation function (stateless, DB-agnostic, unit-testable in isolation) and a stock query service (Drizzle queries filtered by `userId`). The FIFO function operates on plain numbers — no Drizzle types — keeping tests fast and deterministic. The stock service bridges Drizzle `numeric` columns to JS `number` for FIFO consumption, and exists to feed pre-sorted lots into `calculateFifo` when Phase 1E (order creation) arrives.

## Architecture Decisions

### Decision: Co-located test files (`*.test.ts` alongside source)

**Choice**: `apps/api/src/services/fifo.service.test.ts` (same directory as source)
**Alternatives considered**: `apps/api/src/__tests__/` (proposed in spec), `apps/api/tests/`
**Rationale**: The vitest config already uses `include: ['src/**/*.test.ts']`. Co-location keeps import paths trivial (`./fifo.service.js`), matches the existing project convention (no `__tests__` directory exists), and avoids a second glob pattern in vitest config.

### Decision: Drizzle numeric → JS Number conversion in stock.service.ts

**Choice**: Convert `quantityLeft` and `unitCost` to `Number()` inside `getProductStock` / `getStockForProducts` before returning. `calculateFifo` receives plain `number`.
**Alternatives considered**: Use `pg` driver with custom numeric parser (`pg-types`), pass Drizzle results raw into FIFO
**Rationale**: Drizzle with `postgres.js` returns `numeric` columns as strings by default (per PostgreSQL wire protocol). Keeping `calculateFifo` pure-JS avoids coupling it to any ORM or driver. The financial range (max ~9999999.999 for quantities, ~99999999.99 for pesos) fits safely in IEEE 754 double (53-bit mantissa → ~15.9 significant digits). No decimal.js overhead needed.

### Decision: `getStockForProducts` returns `Map<number, StockResult>`, not an array

**Choice**: `Promise<Map<number, { totalStock: number; lots: LotDto[] }>>`
**Alternatives considered**: `Record<number, StockResult>`, array of tuples
**Rationale**: Map provides O(1) lookup by `productId` for the Phase 1E caller, which must correlate FIFO results back to product IDs. Drizzle's `inArray()` already supports batch filtering — the query is a single `db.select().from(purchaseLots).where(and(eq(userId, ...), inArray(productId, [...])))` call.

## Data Flow

```
Phase 1E (Order Creation) ──calls──→ stock.service.ts
                                         │
                                    getStockForProducts([1,5,12], userId)
                                         │
                                    SELECT quantity_left, unit_cost, id
                                    FROM purchase_lots
                                    WHERE user_id = $1
                                      AND product_id IN (1,5,12)
                                    ORDER BY purchased_at ASC
                                         │
                                    Map<productId, { lots: LotDto[] }>
                                         │
                              ┌──────────┴──────────┐
                              ↓                      ↓
                    calculateFifo(lots, 5)   calculateFifo(lots, 3)
                    (productId=1)             (productId=5)
                              │                      │
                         FifoResult              FifoResult
                              │                      │
                              └──────────┬──────────┘
                                         ↓
                              Phase 1E: aggregate costs,
                              check sufficiency, commit transaction
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/services/fifo.service.ts` | Create | Pure `calculateFifo()` function + `FifoConsumption`/`FifoResult` types (~40 lines) |
| `apps/api/src/services/fifo.service.test.ts` | Create | 8+ Vitest unit tests for edge cases (~100 lines) |
| `apps/api/src/services/stock.service.ts` | Create | `getProductStock()` + `getStockForProducts()` query functions (~35 lines) |

> **Note**: `apps/api/src/services/` is a new directory. `apps/api/src/__tests__/` is NOT created — tests are co-located per the vitest config pattern.

## Interfaces / Contracts

```typescript
// ─── fifo.service.ts ───

interface FifoConsumption {
  lotId: number;
  quantityConsumed: number;
  unitCost: number;
}

interface FifoResult {
  consumptions: FifoConsumption[];
  totalCost: number;        // Σ (quantityConsumed × unitCost)
  averageUnitCost: number;  // totalCost / totalConsumedQuantity (0 if none consumed)
  sufficient: boolean;      // false when stock falls short
  shortfall: number;        // unmet quantity (0 if sufficient)
}

interface LotInput {
  id: number;
  quantityLeft: number;
  unitCost: number;
}

function calculateFifo(
  lots: LotInput[],     // MUST be pre-sorted by purchasedAt ASC (caller responsibility)
  quantityNeeded: number
): FifoResult;
```

```typescript
// ─── stock.service.ts ───

interface LotDto {
  id: number;
  quantityLeft: number;
  unitCost: number;
  purchasedAt: Date;
}

interface StockResult {
  totalStock: number;  // SUM(quantityLeft) across all lots
  lots: LotDto[];      // ordered by purchasedAt ASC — ready for calculateFifo
}

function getProductStock(
  productId: number,
  userId: number
): Promise<StockResult>;

function getStockForProducts(
  productIds: number[],
  userId: number
): Promise<Map<number, StockResult>>;
```

### Drizzle Query Patterns

```typescript
// getProductStock: single product
const rows = await db
  .select({
    id: purchaseLots.id,
    quantityLeft: purchaseLots.quantityLeft,
    unitCost: purchaseLots.unitCost,
    purchasedAt: purchaseLots.purchasedAt,
  })
  .from(purchaseLots)
  .where(
    and(
      eq(purchaseLots.userId, userId),
      eq(purchaseLots.productId, productId),
      gt(purchaseLots.quantityLeft, '0'),
    )
  )
  .orderBy(asc(purchaseLots.purchasedAt));

// getStockForProducts: batch query
const rows = await db
  .select({
    productId: purchaseLots.productId,
    id: purchaseLots.id,
    quantityLeft: purchaseLots.quantityLeft,
    unitCost: purchaseLots.unitCost,
    purchasedAt: purchaseLots.purchasedAt,
  })
  .from(purchaseLots)
  .where(
    and(
      eq(purchaseLots.userId, userId),
      inArray(purchaseLots.productId, productIds),
      gt(purchaseLots.quantityLeft, '0'),
    )
  )
  .orderBy(asc(purchaseLots.purchasedAt));
// Post-query: group by productId into Map, cast numeric strings to Number()
```

**Numeric cast**: Drizzle returns `quantityLeft` and `unitCost` as strings from `postgres.js`. The stock service wraps each row with `Number(row.quantityLeft)` and `Number(row.unitCost)` before populating `LotDto`.

**Empty lots filter**: `gt(purchaseLots.quantityLeft, '0')` excludes fully-consumed lots from results. This is both a correctness optimization (zero leftovers can't contribute to FIFO) and prevents `calculateFifo` from iterating over exhausted entries.

## FIFO Algorithm — Step by Step

```
Input:  lots[] (sorted by purchasedAt ASC), quantityNeeded (positive number)
Output: FifoResult

1. remaining ← quantityNeeded
2. consumptions ← []
3. totalCost ← 0

4. FOR each lot in lots:
5.   IF remaining ≤ 0: BREAK
6.   consumed ← min(lot.quantityLeft, remaining)
7.   IF consumed > 0:
8.     consumptions.push({ lotId: lot.id, quantityConsumed: consumed, unitCost: lot.unitCost })
9.     totalCost ← totalCost + (consumed × lot.unitCost)
10.    remaining ← remaining - consumed

11. totalConsumed ← quantityNeeded - remaining
12. averageUnitCost ← totalConsumed > 0 ? totalCost / totalConsumed : 0

13. RETURN {
      consumptions,
      totalCost,
      averageUnitCost,
      sufficient: remaining === 0,
      shortfall: remaining
    }
```

**Immutability guarantee**: The loop reads `lot.quantityLeft` but never writes back. `consumptions` are new objects. No spread copies needed — we process primitives.

**Edge cases handled**:
- `quantityNeeded = 0` → returns empty consumptions, totalCost=0, averageUnitCost=0, sufficient=true, shortfall=0
- `lots = []` → returns empty consumptions, totalCost=0, averageUnitCost=0, sufficient=false (unless quantityNeeded=0)
- Exact match of first lot → consumes exactly that lot, remaining=0, sufficient=true
- Non-zero `shortfall` when sufficient=false → precise unmet quantity, not "rest of total needed"

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `calculateFifo` — 8 scenarios | Vitest, pure function, no mocks. Run with `pnpm vitest run` |
| Unit | `getProductStock` query shape | Vitest with in-memory DB or mock `db.select()` chain (TBD — depends on test DB availability in Phase 1A) |

### FIFO Test Scenario Grid

| # | Scenario | lots | quantityNeeded | sufficient | totalCost |
|---|----------|------|----------------|------------|-----------|
| 1 | Single lot, exact match | `[{id:1, qty:10, cost:5}]` | 10 | true | 50 |
| 2 | Single lot, partial | `[{id:1, qty:10, cost:5}]` | 3 | true | 15 |
| 3 | Two lots, spans both | `[{id:1,qty:5,cost:10}, {id:2,qty:5,cost:20}]` | 7 | true | 5×10 + 2×20 = 90 |
| 4 | Two lots, exactly first | `[{id:1,qty:5,cost:10}, {id:2,qty:5,cost:20}]` | 5 | true | 50 |
| 5 | Insufficient stock | `[{id:1,qty:3,cost:10}]` | 5 | false | 30 |
| 6 | Empty lots array | `[]` | 5 | false | 0 |
| 7 | Zero quantity needed | `[{id:1,qty:10,cost:5}]` | 0 | true | 0 |
| 8 | Weighted average cost | `[{id:1,qty:5,cost:10}, {id:2,qty:5,cost:20}]` | 10 | true | 150 → avg 15 |

These 8 tests prove: exact consumption, partial consumption, multi-lot spanning, shortfall handling, empty input, zero-quantity, exact-first-lot boundary, and weighted-average correctness.

## Migration / Rollout

No migration required. Pure file creation. Rollback: delete `apps/api/src/services/` directory. No DB columns, no route changes, no breaking changes to existing code.

## Open Questions

- None. The design is fully constrained by AGENTS.md sections 5 and 14, and the existing schema.

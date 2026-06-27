# Stock Queries Specification

## Purpose

Read-only Drizzle queries that aggregate `purchase_lots` into per-product stock summaries, ordered by `purchasedAt ASC` so callers can feed them directly to `calculateFifo`. Every query is scoped to the authenticated user to preserve multi-tenant isolation.

## Requirements

### Requirement: getProductStock Query

The system MUST expose `getProductStock(productId, userId)` returning `{ totalStock, lots[] }` where `totalStock` is the sum of `quantityLeft` across the user's lots for that product, and `lots[]` contains `{ id, quantityLeft, unitCost, purchasedAt }`.

#### Scenario: Happy path aggregation

- GIVEN user `u1` owns lots for product `p1` with `quantityLeft` values `5, 3, 2`
- WHEN `getProductStock(p1, u1)` is called
- THEN `totalStock` SHALL equal `10`
- AND `lots` SHALL contain three entries matching the user's lots

#### Scenario: Product with no lots

- GIVEN product `p2` has no purchase lots for user `u1`
- WHEN `getProductStock(p2, u1)` is called
- THEN `totalStock` SHALL equal `0` and `lots` SHALL be `[]`

### Requirement: Lots Ordered By purchasedAt ASC

`lots[]` in the returned object MUST be ordered by `purchasedAt` ascending so the oldest lot is first — a prerequisite for `calculateFifo`.

#### Scenario: Chronological ordering

- GIVEN user `u1` has lots for `p1` with `purchasedAt` values `2026-01-01`, `2025-12-01`, `2026-02-01`
- WHEN `getProductStock(p1, u1)` is called
- THEN `lots[0].purchasedAt` SHALL be `2025-12-01`
- AND `lots[2].purchasedAt` SHALL be `2026-02-01`

### Requirement: Multi-Tenant Isolation

Every stock query MUST filter `purchaseLots` rows by `userId`. User A SHALL NOT see or aggregate any lot belonging to User B.

#### Scenario: Cross-user data hidden

- GIVEN user `u1` has 4 units for `p1` and user `u2` has 6 units for the same `p1`
- WHEN `getProductStock(p1, u1)` is called
- THEN `totalStock` SHALL equal `4` and `lots` SHALL contain only `u1`'s lots

### Requirement: getStockForProducts Batch Query

The system MUST expose `getStockForProducts(productIds[], userId)` returning a map (or array of `{ productId, totalStock, lots[] }`) with one entry per requested product. Each entry SHALL follow the same ordering and isolation rules as `getProductStock`.

#### Scenario: Batch aggregation over multiple products

- GIVEN user `u1` owns lots for `p1` (sum 8) and `p2` (sum 3), and `p3` (no lots)
- WHEN `getStockForProducts([p1, p2, p3], u1)` is called
- THEN the result SHALL include three entries
- AND `p1.totalStock` SHALL equal `8`, `p2.totalStock` SHALL equal `3`, `p3.totalStock` SHALL equal `0`

#### Scenario: Batch query respects tenant isolation

- GIVEN `u1` and `u2` both own lots for `p1` and `p2`
- WHEN `getStockForProducts([p1, p2], u1)` is called
- THEN every returned lot SHALL belong to `u1` only
- AND `u2`'s quantities SHALL NOT contribute to any `totalStock`

### Requirement: Empty Result For Unknown Product

When a requested product has no matching lots for the user, the query MUST return a zero-stock entry rather than omitting the product.

#### Scenario: Unknown product id in batch

- GIVEN `getStockForProducts([p9], u1)` where `p9` has no lots for `u1`
- THEN the result SHALL include `{ productId: p9, totalStock: 0, lots: [] }`

### Requirement: Exclusion Of Other Users Affects totals

`totalStock` MUST be computed strictly from rows where `purchaseLots.userId = userId`. No global aggregation without the user filter is permitted.

#### Scenario: Tenant filter applied to sum

- GIVEN `u1` has 5 units and `u2` has 7 units for `p1`
- WHEN `getProductStock(p1, u1)` returns
- THEN `totalStock` SHALL equal `5` (NOT `12`)

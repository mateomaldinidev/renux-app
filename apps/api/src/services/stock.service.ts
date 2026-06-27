import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { purchaseLots } from '../db/schema.js';

export interface LotDto {
  id: number;
  quantityLeft: number;
  unitCost: number;
  purchasedAt: Date;
}

export interface StockResult {
  totalStock: number;
  lots: LotDto[];
}

/**
 * Get stock summary for a single product scoped to the given user.
 *
 * Returns total stock (sum of quantityLeft) and the individual lots
 * sorted by purchasedAt ASC, ready to feed into `calculateFifo`.
 * Numeric columns are converted from Drizzle strings to JS numbers.
 *
 * @param productId - Product to query
 * @param userId - Authenticated user scope (multi-tenant isolation)
 * @returns StockResult with totalStock and lots array
 */
export async function getProductStock(productId: number, userId: number): Promise<StockResult> {
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
      ),
    )
    .orderBy(asc(purchaseLots.purchasedAt));

  const lots: LotDto[] = rows.map((row) => ({
    id: row.id,
    quantityLeft: Number(row.quantityLeft),
    unitCost: Number(row.unitCost),
    purchasedAt: row.purchasedAt,
  }));

  const totalStock = lots.reduce((sum, lot) => sum + lot.quantityLeft, 0);

  return { totalStock, lots };
}

/**
 * Get stock summaries for multiple products in a single batch query.
 *
 * Executes one `SELECT ... FROM purchase_lots WHERE product_id IN (...)` query,
 * groups results by productId, and returns a Map with zero-stock fallback
 * entries for products that have no lots.
 *
 * @param productIds - Products to query (empty array returns empty Map)
 * @param userId - Authenticated user scope (multi-tenant isolation)
 * @returns Map<productId, StockResult>
 */
export async function getStockForProducts(
  productIds: number[],
  userId: number,
): Promise<Map<number, StockResult>> {
  if (productIds.length === 0) {
    return new Map();
  }

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
      ),
    )
    .orderBy(asc(purchaseLots.purchasedAt));

  // Group rows by productId preserving order
  const grouped = new Map<number, LotDto[]>();

  for (const row of rows) {
    const lot: LotDto = {
      id: row.id,
      quantityLeft: Number(row.quantityLeft),
      unitCost: Number(row.unitCost),
      purchasedAt: row.purchasedAt,
    };

    const existing = grouped.get(row.productId);
    if (existing) {
      existing.push(lot);
    } else {
      grouped.set(row.productId, [lot]);
    }
  }

  // Build result map: every requested productId gets an entry,
  // even if it has no lots (zero-stock fallback)
  const result = new Map<number, StockResult>();

  for (const productId of productIds) {
    const lots = grouped.get(productId);
    if (lots) {
      const totalStock = lots.reduce((sum, lot) => sum + lot.quantityLeft, 0);
      result.set(productId, { totalStock, lots });
    } else {
      result.set(productId, { totalStock: 0, lots: [] });
    }
  }

  return result;
}

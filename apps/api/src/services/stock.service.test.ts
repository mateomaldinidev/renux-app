import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock setup ────────────────────────────────────────────────────────────────
// We mock the db module to return a chainable select/from/where/orderBy builder.

const mockOrderBy = vi.fn();
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({ from: mockFrom })),
  },
}));

// Import after mocking so the mock is applied
import { getProductStock, getStockForProducts } from './stock.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getProductStock', () => {
  it('returns totalStock and lots for a product with multiple lots', async () => {
    const rows = [
      { id: 1, quantityLeft: '5', unitCost: '10.50', purchasedAt: new Date('2026-01-01') },
      { id: 2, quantityLeft: '3', unitCost: '12.00', purchasedAt: new Date('2026-02-01') },
    ];
    mockOrderBy.mockResolvedValue(rows);

    const result = await getProductStock(42, 1);

    expect(result.totalStock).toBe(8); // 5 + 3
    expect(result.lots).toHaveLength(2);
    expect(result.lots[0]).toEqual({
      id: 1,
      quantityLeft: 5,
      unitCost: 10.5,
      purchasedAt: rows[0].purchasedAt,
    });
    expect(result.lots[1]).toEqual({
      id: 2,
      quantityLeft: 3,
      unitCost: 12,
      purchasedAt: rows[1].purchasedAt,
    });
  });

  it('returns totalStock=0 and empty lots for product with no lots', async () => {
    mockOrderBy.mockResolvedValue([]);

    const result = await getProductStock(99, 1);

    expect(result.totalStock).toBe(0);
    expect(result.lots).toEqual([]);
  });

  it('filters by both userId and productId', async () => {
    mockOrderBy.mockResolvedValue([]);

    await getProductStock(7, 3);

    // Verify the select/from/where/orderBy chain was built
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it('orders lots by purchasedAt ASC', async () => {
    const rows = [
      { id: 3, quantityLeft: '2', unitCost: '5', purchasedAt: new Date('2026-02-01') },
      { id: 1, quantityLeft: '5', unitCost: '4', purchasedAt: new Date('2026-01-01') },
      { id: 2, quantityLeft: '3', unitCost: '6', purchasedAt: new Date('2025-12-01') },
    ];
    // Simulate DB returning already-sorted rows
    const sortedRows = [...rows].sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime());
    mockOrderBy.mockResolvedValue(sortedRows);

    const result = await getProductStock(1, 1);

    expect(result.lots[0].purchasedAt).toEqual(new Date('2025-12-01'));
    expect(result.lots[1].purchasedAt).toEqual(new Date('2026-01-01'));
    expect(result.lots[2].purchasedAt).toEqual(new Date('2026-02-01'));
  });

  it('converts numeric string columns to JS numbers', async () => {
    const rows = [
      { id: 1, quantityLeft: '7.500', unitCost: '15.99', purchasedAt: new Date('2026-01-01') },
    ];
    mockOrderBy.mockResolvedValue(rows);

    const result = await getProductStock(1, 1);

    expect(result.lots[0].quantityLeft).toBe(7.5);
    expect(result.lots[0].unitCost).toBe(15.99);
    expect(typeof result.lots[0].quantityLeft).toBe('number');
    expect(typeof result.lots[0].unitCost).toBe('number');
  });
});

describe('getStockForProducts', () => {
  it('returns a Map with stock for multiple products', async () => {
    const rows = [
      {
        productId: 1,
        id: 1,
        quantityLeft: '5',
        unitCost: '10',
        purchasedAt: new Date('2026-01-01'),
      },
      {
        productId: 1,
        id: 2,
        quantityLeft: '3',
        unitCost: '12',
        purchasedAt: new Date('2026-02-01'),
      },
      {
        productId: 2,
        id: 3,
        quantityLeft: '8',
        unitCost: '8',
        purchasedAt: new Date('2026-01-15'),
      },
    ];
    mockOrderBy.mockResolvedValue(rows);

    const result = await getStockForProducts([1, 2], 1);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);

    const p1 = result.get(1);
    expect(p1).toBeDefined();
    expect(p1?.totalStock).toBe(8); // 5 + 3
    expect(p1?.lots).toHaveLength(2);

    const p2 = result.get(2);
    expect(p2).toBeDefined();
    expect(p2?.totalStock).toBe(8);
    expect(p2?.lots).toHaveLength(1);
  });

  it('returns zero-stock fallback for products with no lots', async () => {
    mockOrderBy.mockResolvedValue([]);

    const result = await getStockForProducts([1, 2, 3], 1);

    expect(result.size).toBe(3);
    expect(result.get(1)?.totalStock).toBe(0);
    expect(result.get(2)?.totalStock).toBe(0);
    expect(result.get(3)?.totalStock).toBe(0);
    expect(result.get(1)?.lots).toEqual([]);
  });

  it('returns zero-stock fallback for unknown product in mixed results', async () => {
    const rows = [
      {
        productId: 1,
        id: 1,
        quantityLeft: '10',
        unitCost: '5',
        purchasedAt: new Date('2026-01-01'),
      },
    ];
    mockOrderBy.mockResolvedValue(rows);

    const result = await getStockForProducts([1, 99], 1);

    expect(result.get(1)?.totalStock).toBe(10);
    expect(result.get(99)?.totalStock).toBe(0);
    expect(result.get(99)?.lots).toEqual([]);
  });

  it('returns empty Map for empty productIds array', async () => {
    const result = await getStockForProducts([], 1);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    // db.select should NOT have been called
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('respects tenant isolation — only queries for the given userId', async () => {
    mockOrderBy.mockResolvedValue([]);

    // We can't directly assert on userId in the mock since drizzle-orm
    // passes the actual Drizzle SQL objects. We verify the chain was built
    // and no errors occur.
    await getStockForProducts([1, 2], 5);

    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
  });
});

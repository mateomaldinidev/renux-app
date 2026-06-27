import { describe, expect, it } from 'vitest';
import { calculateFifo } from './fifo.service.js';

describe('calculateFifo', () => {
  // Scenario 1: Single lot, exact match
  it('consumes exact quantity from a single lot', () => {
    const result = calculateFifo([{ id: 1, quantityLeft: 10, unitCost: 5 }], 10);

    expect(result.consumptions).toEqual([{ lotId: 1, quantityConsumed: 10, unitCost: 5 }]);
    expect(result.totalCost).toBe(50);
    expect(result.averageUnitCost).toBe(5);
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  // Scenario 2: Single lot, partial consumption
  it('consumes partial quantity from a single lot', () => {
    const result = calculateFifo([{ id: 1, quantityLeft: 10, unitCost: 5 }], 3);

    expect(result.consumptions).toEqual([{ lotId: 1, quantityConsumed: 3, unitCost: 5 }]);
    expect(result.totalCost).toBe(15);
    expect(result.averageUnitCost).toBe(5);
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  // Scenario 3: Two lots, spans both (FIFO order)
  it('consumes oldest lot first when spanning multiple lots', () => {
    const result = calculateFifo(
      [
        { id: 1, quantityLeft: 5, unitCost: 10 },
        { id: 2, quantityLeft: 5, unitCost: 20 },
      ],
      7,
    );

    expect(result.consumptions).toEqual([
      { lotId: 1, quantityConsumed: 5, unitCost: 10 },
      { lotId: 2, quantityConsumed: 2, unitCost: 20 },
    ]);
    expect(result.totalCost).toBe(90); // 5*10 + 2*20
    expect(result.averageUnitCost).toBeCloseTo(90 / 7, 10);
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  // Scenario 4: Two lots, exactly first (exact match of first lot)
  it('consumes exactly the first lot without touching the second', () => {
    const result = calculateFifo(
      [
        { id: 1, quantityLeft: 5, unitCost: 10 },
        { id: 2, quantityLeft: 5, unitCost: 20 },
      ],
      5,
    );

    expect(result.consumptions).toEqual([{ lotId: 1, quantityConsumed: 5, unitCost: 10 }]);
    expect(result.totalCost).toBe(50);
    expect(result.averageUnitCost).toBe(10);
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  // Scenario 5: Insufficient stock
  it('returns sufficient=false and correct shortfall when stock is insufficient', () => {
    const result = calculateFifo([{ id: 1, quantityLeft: 3, unitCost: 10 }], 5);

    expect(result.consumptions).toEqual([{ lotId: 1, quantityConsumed: 3, unitCost: 10 }]);
    expect(result.totalCost).toBe(30);
    expect(result.averageUnitCost).toBe(10);
    expect(result.sufficient).toBe(false);
    expect(result.shortfall).toBe(2);
  });

  // Scenario 6: Empty lots array
  it('handles empty lots array', () => {
    const result = calculateFifo([], 5);

    expect(result.consumptions).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.averageUnitCost).toBe(0);
    expect(result.sufficient).toBe(false);
    expect(result.shortfall).toBe(5);
  });

  // Scenario 7: Zero quantity needed
  it('handles zero quantity needed', () => {
    const result = calculateFifo([{ id: 1, quantityLeft: 10, unitCost: 5 }], 0);

    expect(result.consumptions).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.averageUnitCost).toBe(0);
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  // Scenario 8: Weighted average cost across multiple lots
  it('calculates weighted average cost across multiple lots', () => {
    const result = calculateFifo(
      [
        { id: 1, quantityLeft: 5, unitCost: 10 },
        { id: 2, quantityLeft: 5, unitCost: 20 },
      ],
      10,
    );

    expect(result.consumptions).toEqual([
      { lotId: 1, quantityConsumed: 5, unitCost: 10 },
      { lotId: 2, quantityConsumed: 5, unitCost: 20 },
    ]);
    expect(result.totalCost).toBe(150);
    expect(result.averageUnitCost).toBe(15);
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  // Input immutability
  it('does not mutate input lots array or lot objects', () => {
    const lots = [{ id: 1, quantityLeft: 5, unitCost: 10 }];
    const snapshot = { id: 1, quantityLeft: 5, unitCost: 10 };

    calculateFifo(lots, 3);

    expect(lots[0]).toEqual(snapshot);
    expect(lots[0].quantityLeft).toBe(5);
    expect(lots.length).toBe(1);
  });
});

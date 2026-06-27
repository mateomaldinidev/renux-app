export interface FifoConsumption {
  lotId: number;
  quantityConsumed: number;
  unitCost: number;
}

export interface FifoResult {
  consumptions: FifoConsumption[];
  totalCost: number;
  averageUnitCost: number;
  sufficient: boolean;
  shortfall: number;
}

export interface LotInput {
  id: number;
  quantityLeft: number;
  unitCost: number;
}

/**
 * Calculate FIFO cost from pre-sorted purchase lots.
 *
 * Iterates lots in order (caller MUST pass them sorted by purchasedAt ASC),
 * consumes from the oldest lot first, and returns detailed consumption info.
 *
 * Never mutates the input array or lot objects.
 *
 * @param lots - Purchase lots sorted by purchasedAt ASC (caller responsibility)
 * @param quantityNeeded - Quantity to consume (non-negative)
 * @returns FifoResult with per-lot consumptions, total cost, and sufficiency info
 */
export function calculateFifo(lots: LotInput[], quantityNeeded: number): FifoResult {
  let remaining = quantityNeeded;
  const consumptions: FifoConsumption[] = [];
  let totalCost = 0;

  for (const lot of lots) {
    if (remaining <= 0) {
      break;
    }

    const consumed = Math.min(lot.quantityLeft, remaining);

    if (consumed > 0) {
      consumptions.push({
        lotId: lot.id,
        quantityConsumed: consumed,
        unitCost: lot.unitCost,
      });

      totalCost += consumed * lot.unitCost;
      remaining -= consumed;
    }
  }

  const totalConsumed = quantityNeeded - remaining;
  const averageUnitCost = totalConsumed > 0 ? totalCost / totalConsumed : 0;

  return {
    consumptions,
    totalCost,
    averageUnitCost,
    sufficient: remaining === 0,
    shortfall: remaining,
  };
}

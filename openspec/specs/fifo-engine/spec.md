# Fifo Engine Specification

## Purpose

Pure, stateless FIFO cost-calculation function that consumes pre-sorted purchase lots oldest-first and returns per-lot consumptions, weighted-average cost, a sufficiency flag, and any shortfall. No database access; fully unit-testable.

## Requirements

### Requirement: calculateFifo Function Signature

The system MUST expose `calculateFifo(lots, quantityNeeded)` accepting lots `{ id, quantityLeft, unitCost }[]` ordered by `purchasedAt ASC` and a non-negative `quantityNeeded`. It SHALL return a `FifoResult` containing `consumptions: FifoConsumption[]`, `totalCost`, `averageUnitCost`, `sufficient: boolean`, and `shortfall: number`.

#### Scenario: Return shape contract

- GIVEN a valid `lots` array and a positive `quantityNeeded`
- WHEN `calculateFifo` is called
- THEN the returned object MUST contain all five `FifoResult` fields
- AND `consumptions` SHALL be an array of `{ lotId, quantityConsumed, unitCost }`

### Requirement: Single Lot Partial Consumption

The system MUST consume only the needed quantity from a single lot and compute cost from that lot's `unitCost`.

#### Scenario: Partial use of one lot

- GIVEN one lot `{ id: 1, quantityLeft: 10, unitCost: 100 }`
- WHEN `calculateFifo` is called with `quantityNeeded = 4`
- THEN `consumptions` SHALL equal `[{ lotId: 1, quantityConsumed: 4, unitCost: 100 }]`
- AND `totalCost` SHALL equal `400`
- AND `averageUnitCost` SHALL equal `100`
- AND `sufficient` SHALL be `true`, `shortfall` SHALL be `0`

### Requirement: FIFO Ordering Across Multiple Lots

The system MUST consume the oldest lot fully before touching the next, producing consumptions in input order.

#### Scenario: Two lots, split consumption

- GIVEN lots `[{ id: 1, quantityLeft: 5, unitCost: 100 }, { id: 2, quantityLeft: 5, unitCost: 200 }]` ordered oldest-first
- WHEN `calculateFifo` is called with `quantityNeeded = 7`
- THEN `consumptions` SHALL equal `[{ lotId: 1, quantityConsumed: 5, unitCost: 100 }, { lotId: 2, quantityConsumed: 2, unitCost: 200 }]`
- AND `totalCost` SHALL equal `900`, `averageUnitCost` SHALL equal `900/7`

### Requirement: Weighted Average Cost

`averageUnitCost` SHALL equal `totalCost / sum(quantityConsumed)` across all consumed lots.

#### Scenario: Average reflects mix of unit costs

- GIVEN lots fully spanning multiple costs totaling `quantityNeeded`
- WHEN `calculateFifo` runs
- THEN `averageUnitCost` SHALL equal `totalCost` divided by total consumed quantity
- AND rounding MUST preserve monetary precision (2 decimals)

### Requirement: Exact Match Sufficiency

When total available stock equals the requested quantity, `sufficient` MUST be `true` and `shortfall` MUST be `0`.

#### Scenario: Demand equals supply

- GIVEN lots whose `quantityLeft` sum to exactly `10`
- WHEN `calculateFifo` is called with `quantityNeeded = 10`
- THEN `sufficient` SHALL be `true`, `shortfall` SHALL be `0`
- AND every lot SHALL be fully consumed

### Requirement: Insufficient Stock

When total available stock is less than requested, `sufficient` MUST be `false` and `shortfall` SHALL equal the missing quantity. The function MUST NOT partially consume lots in the result; consumptions reflect only what is available.

#### Scenario: Demand exceeds supply

- GIVEN one lot `{ id: 1, quantityLeft: 3, unitCost: 50 }`
- WHEN `calculateFifo` is called with `quantityNeeded = 10`
- THEN `sufficient` SHALL be `false`, `shortfall` SHALL equal `7`
- AND `consumptions` SHALL contain only the available `3` units from lot 1
- AND `totalCost` SHALL reflect consumed units only

### Requirement: Empty Lots

When the `lots` array is empty, `sufficient` MUST be `false` and `shortfall` SHALL equal the full `quantityNeeded`.

#### Scenario: No lots available

- GIVEN an empty `lots` array
- WHEN `calculateFifo` is called with `quantityNeeded = 5`
- THEN `consumptions` SHALL be `[]`, `totalCost` SHALL be `0`
- AND `sufficient` SHALL be `false`, `shortfall` SHALL equal `5`

### Requirement: Zero Quantity Requested

When `quantityNeeded` is `0`, the system SHALL return an empty consumptions array with `sufficient = true` and `shortfall = 0`.

#### Scenario: Zero demand

- GIVEN any non-empty `lots` array
- WHEN `calculateFifo` is called with `quantityNeeded = 0`
- THEN `consumptions` SHALL be `[]`, `totalCost` SHALL be `0`
- AND `sufficient` SHALL be `true`, `shortfall` SHALL be `0`

### Requirement: Input Immutability

The function MUST NOT mutate the input `lots` array or any lot object. Callers SHALL observe identical lot state before and after invocation.

#### Scenario: Caller lots unchanged

- GIVEN a `lots` array with known `quantityLeft` values
- WHEN `calculateFifo` is called and returns
- THEN every input lot's `quantityLeft` SHALL equal its pre-call value
- AND the input array reference and length SHALL be unchanged

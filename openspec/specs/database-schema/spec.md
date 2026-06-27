# Database Schema Specification

## Purpose

Complete PostgreSQL 16 schema for RENUX via Drizzle ORM. Nine tables covering users, suppliers, products with price variants, composite components, FIFO-ready purchase lots, orders with state machine, order lines with point-in-time cost capture, and multi-tenant expenses. Multi-tenancy is enforced by `user_id` on all core business tables.

## Requirements

### Requirement: Nine tables exist after migration

The migration MUST create exactly the following tables (9 total): `users`, `suppliers`, `products`, `price_variants`, `composite_components`, `purchase_lots`, `orders`, `order_lines`, `expenses`. The migration SHALL NOT create a `stock_losses` table (merma is out of scope).

#### Scenario: Migration creates the expected schema

- GIVEN an empty PostgreSQL database
- WHEN `drizzle-kit migrate` is applied
- THEN the tables `users`, `suppliers`, `products`, `price_variants`, `composite_components`, `purchase_lots`, `orders`, `order_lines`, `expenses` exist
- AND a `stock_losses` table does NOT exist
- AND the three enum types (`product_type`, `unit`, `order_status`) are defined

### Requirement: Enum types are defined

The schema MUST define three PostgreSQL enums: `product_type` (`simple`, `mix`, `promotion`), `unit` (`kg`, `unit`), `order_status` (`INGRESADO`, `PREPARADO`, `ENTREGADO`, `ADEUDA_PAGO`).

#### Scenario: Order status enum values

- GIVEN the migration has run
- WHEN the `order_status` enum is inspected
- THEN it contains exactly `INGRESADO`, `PREPARADO`, `ENTREGADO`, `ADEUDA_PAGO`

### Requirement: Multi-tenant foreign keys on core tables

`products`, `orders`, `expenses`, and `purchase_lots` MUST have a non-null `user_id` column with a foreign key to `users.id`. `suppliers` is shared (no `user_id`).

#### Scenario: User isolation columns

- GIVEN the migrated schema
- WHEN `products`, `orders`, `expenses`, `purchase_lots` are inspected
- THEN each has a `user_id` column that is NOT NULL
- AND each references `users.id`
- AND `suppliers` has no `user_id` column

### Requirement: Products support simple, mix, and promotion types

The `products` table MUST include `type` (enum, default `simple`), `unit` (enum, default `kg`), `active` (boolean, default true), and `notes` (nullable text).

#### Scenario: Default values on insert

- WHEN a product is inserted without `type` or `unit`
- THEN `type` defaults to `simple` and `unit` defaults to `kg`
- AND `active` defaults to `true`

### Requirement: Price variants capture offer state

`price_variants` MUST store `label`, `quantity` (numeric 10,3), `base_price`, and nullable `offer_price`. The boolean `offer_active` MUST default to `false`.

#### Scenario: Variant without offer

- WHEN a variant is inserted without `offer_price`
- THEN `offer_price` is NULL and `offer_active` is `false`

#### Scenario: Variant with active offer

- WHEN a variant is inserted with `offer_price = 1500` and `offer_active = true`
- THEN both values persist and can be read back

### Requirement: Composite components link parents to components

`composite_components` MUST reference `parent_id` (the mix or promo) and `component_id` (a simple product) with a `quantity` per component. Both references SHALL point to `products.id`.

#### Scenario: Mix composition

- GIVEN a mix product and two simple products
- WHEN rows are inserted into `composite_components`
- THEN each row stores the parent, component, and quantity
- AND the `component_id` references a `simple` product

### Requirement: Purchase lots support FIFO

`purchase_lots` MUST store `quantity_initial`, `quantity_left` (numeric 10,3), `unit_cost` (numeric 10,2), `purchased_at` (timestamp), nullable `supplier_id`, and `notes`. `quantity_left` is consumed over time by order FIFO.

#### Scenario: Fresh purchase lot

- WHEN a purchase lot is inserted with `quantity_initial = 10`, `quantity_left = 10`, `unit_cost = 2500`
- THEN all three values persist and `quantity_left` equals `quantity_initial` initially

### Requirement: Order lines capture point-in-time price and cost

`order_lines` MUST store `unit_price` and `unit_cost` at sale time, alongside `quantity`, `line_total`, and `line_cost`. Prices are never recomputed from current variants.

#### Scenario: Price snapshot at sale time

- GIVEN an order line created when a variant's price was 3000
- WHEN the variant's price is later changed
- THEN the order line still shows `unit_price = 3000`

### Requirement: Orders record discount, totals, and delivery

`orders` MUST store `status` (enum), `discount_type` and `discount_value` (nullable), `subtotal`, `discount_amount`, `total`, `total_cost`, nullable `customer_name` and `notes`, and `delivered_at` (nullable, set on ENTREGADO).

#### Scenario: Order defaults

- WHEN an order is inserted without a `status`
- THEN `status` defaults to `INGRESADO` and `delivered_at` is NULL

### Requirement: Expenses categorize operational costs

`expenses` MUST store `description`, `amount`, nullable `category` (`packaging`, `envios`, `general`), `occurred_at`, and nullable `notes`.

#### Scenario: Categorized expense

- WHEN an expense is inserted with `category = 'envios'`
- THEN the category persists and is filterable

### Requirement: Seed creates users and demo sample data

The seed script MUST read `ADMIN_PASSWORD` and `DEMO_PASSWORD` from env, hash both with bcryptjs, and insert `admin` and `demo` users. It SHALL also insert sample products, purchases, and orders for the `demo` user only (portfolio data). The `admin` user starts with no business data.

#### Scenario: Seed idempotency

- GIVEN the seed has already run once
- WHEN the seed is run again
- THEN it does not create duplicate users (upsert or skip)

#### Scenario: Demo sample data

- GIVEN the seed completes
- WHEN the `demo` user's data is queried
- THEN sample products, purchase lots, and orders exist
- AND the `admin` user has no rows in `products`, `orders`, `expenses`, or `purchase_lots`
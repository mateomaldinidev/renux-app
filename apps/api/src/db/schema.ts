import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const productTypeEnum = pgEnum('product_type', ['simple', 'mix', 'promotion']);
export const unitEnum = pgEnum('unit', ['kg', 'unit']);
export const orderStatusEnum = pgEnum('order_status', [
  'INGRESADO',
  'PREPARADO',
  'ENTREGADO',
  'ADEUDA_PAGO',
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Products ─────────────────────────────────────────────────────────────────

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(),
  type: productTypeEnum('type').notNull().default('simple'),
  unit: unitEnum('unit').notNull().default('kg'),
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Price Variants ───────────────────────────────────────────────────────────

export const priceVariants = pgTable('price_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  label: varchar('label', { length: 50 }).notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  offerPrice: numeric('offer_price', { precision: 10, scale: 2 }),
  offerActive: boolean('offer_active').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Composite Components ────────────────────────────────────────────────────

export const compositeComponents = pgTable('composite_components', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id')
    .notNull()
    .references(() => products.id),
  componentId: integer('component_id')
    .notNull()
    .references(() => products.id),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
});

// ─── Purchase Lots ────────────────────────────────────────────────────────────

export const purchaseLots = pgTable('purchase_lots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  quantityInitial: numeric('quantity_initial', { precision: 10, scale: 3 }).notNull(),
  quantityLeft: numeric('quantity_left', { precision: 10, scale: 3 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 10, scale: 2 }).notNull(),
  purchasedAt: timestamp('purchased_at').defaultNow().notNull(),
  notes: text('notes'),
});

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  customerName: varchar('customer_name', { length: 100 }),
  status: orderStatusEnum('status').notNull().default('INGRESADO'),
  discountType: varchar('discount_type', { length: 10 }),
  discountValue: numeric('discount_value', { precision: 10, scale: 2 }),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  totalCost: numeric('total_cost', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
});

// ─── Order Lines ──────────────────────────────────────────────────────────────

export const orderLines = pgTable('order_lines', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  priceVariantId: integer('price_variant_id')
    .notNull()
    .references(() => priceVariants.id),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 10, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 10, scale: 2 }).notNull(),
  lineCost: numeric('line_cost', { precision: 10, scale: 2 }).notNull(),
});

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  description: varchar('description', { length: 150 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  category: varchar('category', { length: 50 }),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  notes: text('notes'),
});

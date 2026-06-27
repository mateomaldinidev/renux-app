import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from './index.js';
import {
  compositeComponents,
  orderLines,
  orders,
  priceVariants,
  products,
  purchaseLots,
  suppliers,
  users,
} from './schema.js';

async function getOrCreateUser(username: string, password: string): Promise<number> {
  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing) {
    console.log(`  ℹ️  User "${username}" already exists, skipping`);
    return existing.id;
  }

  const hash = await bcrypt.hash(password, 10);
  const [inserted] = await db.insert(users).values({ username, passwordHash: hash }).returning();
  console.log(`  ✅ Created user "${username}"`);
  return inserted.id;
}

async function seed() {
  console.log('🌱 Seeding database...\n');

  // ── Users ──────────────────────────────────────────────────────────────────
  const _adminId = await getOrCreateUser('admin', config.ADMIN_PASSWORD);
  const demoId = await getOrCreateUser('demo', config.DEMO_PASSWORD);

  // Only insert demo sample data if this is a fresh seed
  const existingProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.userId, demoId))
    .limit(1);

  if (existingProducts.length > 0) {
    console.log('\n  ℹ️  Demo data already exists, skipping sample data');
    console.log('\n✅ Seed complete');
    return;
  }

  // ── Demo Sample Data ──────────────────────────────────────────────────────

  // Simple products
  const [mani] = await db
    .insert(products)
    .values({
      userId: demoId,
      name: 'Maní salado',
      type: 'simple',
      unit: 'kg',
      notes: 'Maní pelado salado x kilo',
    })
    .returning();

  const [almendras] = await db
    .insert(products)
    .values({
      userId: demoId,
      name: 'Almendras',
      type: 'simple',
      unit: 'kg',
      notes: 'Almendras enteras sin sal',
    })
    .returning();

  const [pasas] = await db
    .insert(products)
    .values({
      userId: demoId,
      name: 'Pasas de uva',
      type: 'simple',
      unit: 'kg',
      notes: 'Pasas de uva sin semilla',
    })
    .returning();

  // Mix product
  const [mixEnergético] = await db
    .insert(products)
    .values({
      userId: demoId,
      name: 'Mix energético',
      type: 'mix',
      unit: 'kg',
      notes: 'Mezcla de almendras, maní y pasas',
    })
    .returning();

  // Promotion
  const [promoMundial] = await db
    .insert(products)
    .values({
      userId: demoId,
      name: 'Promo Mundial',
      type: 'promotion',
      unit: 'kg',
      notes: 'Pack especial promocional',
    })
    .returning();

  console.log('  ✅ Created 5 sample products');

  // Price variants
  // Maní: 1kg, 500g, 250g
  await db.insert(priceVariants).values([
    { productId: mani.id, label: '1 kg', quantity: '1', basePrice: '2500' },
    { productId: mani.id, label: '500 g', quantity: '0.5', basePrice: '1300' },
    { productId: mani.id, label: '250 g', quantity: '0.25', basePrice: '700' },
    // Almendras: 1kg, 500g
    { productId: almendras.id, label: '1 kg', quantity: '1', basePrice: '4200' },
    { productId: almendras.id, label: '500 g', quantity: '0.5', basePrice: '2200' },
    // Pasas: 1kg, 500g
    { productId: pasas.id, label: '1 kg', quantity: '1', basePrice: '1800' },
    { productId: pasas.id, label: '500 g', quantity: '0.5', basePrice: '950' },
    // Mix: 1kg, 500g
    { productId: mixEnergético.id, label: '1 kg', quantity: '1', basePrice: '3200' },
    { productId: mixEnergético.id, label: '500 g', quantity: '0.5', basePrice: '1700' },
    // Promo: Unidad
    { productId: promoMundial.id, label: 'Unidad', quantity: '1', basePrice: '5500' },
  ]);
  console.log('  ✅ Created 10 price variants');

  // Composite components
  await db.insert(compositeComponents).values([
    { parentId: mixEnergético.id, componentId: almendras.id, quantity: '0.4' },
    { parentId: mixEnergético.id, componentId: mani.id, quantity: '0.3' },
    { parentId: mixEnergético.id, componentId: pasas.id, quantity: '0.3' },
    { parentId: promoMundial.id, componentId: mixEnergético.id, quantity: '0.5' },
    { parentId: promoMundial.id, componentId: mani.id, quantity: '0.5' },
  ]);
  console.log('  ✅ Created composite components');

  // Supplier
  const [proveedor1] = await db
    .insert(suppliers)
    .values({
      name: 'Distribuidora Norte',
      phone: '11-5555-0101',
      notes: 'Proveedor principal de frutos secos',
    })
    .returning();
  console.log('  ✅ Created 1 supplier');

  // Purchase lots (FIFO test data)
  await db.insert(purchaseLots).values([
    {
      userId: demoId,
      productId: mani.id,
      supplierId: proveedor1.id,
      quantityInitial: '10',
      quantityLeft: '8',
      unitCost: '1500',
      purchasedAt: new Date('2026-06-01'),
    },
    {
      userId: demoId,
      productId: mani.id,
      supplierId: proveedor1.id,
      quantityInitial: '5',
      quantityLeft: '5',
      unitCost: '1800',
      purchasedAt: new Date('2026-06-15'),
    },
    {
      userId: demoId,
      productId: almendras.id,
      supplierId: proveedor1.id,
      quantityInitial: '8',
      quantityLeft: '6',
      unitCost: '3200',
      purchasedAt: new Date('2026-06-05'),
    },
    {
      userId: demoId,
      productId: pasas.id,
      supplierId: proveedor1.id,
      quantityInitial: '12',
      quantityLeft: '10',
      unitCost: '1200',
      purchasedAt: new Date('2026-06-10'),
    },
  ]);
  console.log('  ✅ Created 4 purchase lots');

  // Sample order
  const [order1] = await db
    .insert(orders)
    .values({
      userId: demoId,
      customerName: 'Juan Pérez',
      status: 'ENTREGADO',
      subtotal: '8200',
      discountAmount: '0',
      total: '8200',
      totalCost: '5100',
      notes: 'Primer pedido de ejemplo',
      deliveredAt: new Date('2026-06-20'),
    })
    .returning();

  await db.insert(orderLines).values([
    {
      orderId: order1.id,
      productId: mani.id,
      priceVariantId: 1, // 1kg variant
      quantity: '1',
      unitPrice: '2500',
      unitCost: '1500',
      lineTotal: '2500',
      lineCost: '1500',
    },
    {
      orderId: order1.id,
      productId: almendras.id,
      priceVariantId: 4, // 1kg variant
      quantity: '1',
      unitPrice: '4200',
      unitCost: '3200',
      lineTotal: '4200',
      lineCost: '3200',
    },
    {
      orderId: order1.id,
      productId: pasas.id,
      priceVariantId: 6, // 1kg variant
      quantity: '1',
      unitPrice: '1500',
      unitCost: '400',
      lineTotal: '1500',
      lineCost: '400',
    },
  ]);
  console.log('  ✅ Created 1 sample order with 3 lines');

  console.log('\n✅ Seed complete');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

# RENUX — Roadmap de Desarrollo

> Plan completo de implementación. Cada fase es un cambio SDD independiente.
> Este documento es la fuente de verdad para el orden y alcance de cada fase.

---

## Decisiones de arquitectura

| Decisión | Detalle |
|----------|---------|
| **Stack** | React 19 + Hono + Drizzle + PostgreSQL |
| **Monorepo** | pnpm workspace (`apps/web` + `apps/api`) |
| **Tooling** | Biome (lint + format), Vitest (testing), TypeScript strict |
| **DB** | PostgreSQL 16 via Docker Compose |
| **Auth** | JWT, 2 usuarios (admin real + demo portfolio) |
| **Aislamiento** | Multi-tenancy: `user_id` en tablas principales. Cada usuario ve solo sus datos. |
| **Diseño** | OpenPencil vía MCP entre backend y frontend |
| **FIFO** | Costeo real por lote. Probado exhaustivamente antes de construir pedidos. |

## Lo que NO incluye esta versión

- ❌ Merma (stock loss) — removido por el usuario
- ❌ Historial de clientes — solo campo `customerName`
- ❌ Exportación PDF/Excel
- ❌ Notificaciones de stock bajo
- ❌ App móvil
- ❌ Procesamiento de pagos / MercadoPago

---

## Fase 1 — Backend

### 1A — Scaffolding (~445 líneas)
**Objetivo**: Fundación del proyecto. Al terminar, el servidor acepta login y devuelve JWT.

- [ ] Monorepo: `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `biome.json`
- [ ] Docker Compose con PostgreSQL 16
- [ ] `apps/api`: Hono server con health check
- [ ] Drizzle ORM + conexión a PostgreSQL
- [ ] Schema completo (9 tablas, sin `stock_losses`, con `user_id` en products, orders, expenses, purchaseLots)
- [ ] `AppError` + middleware global de errores
- [ ] Middleware JWT + rutas auth (`login`, `me`, `logout`)
- [ ] Seed: 2 usuarios (admin + demo) + datos de ejemplo para demo
- [ ] `config.ts`: validación de variables de entorno con Zod
- [ ] Vitest config para API

### 1B — FIFO + Stock (~350 líneas)
**Objetivo**: Lógica de costeo probada a fondo. El módulo más crítico del sistema.

- [ ] `fifo.service.ts`: `calculateFifo()` pura, sin dependencias de DB
- [ ] Tests unitarios exhaustivos (8+ escenarios: lote único, múltiples lotes, insuficiente, producto compuesto, etc.)
- [ ] `stock.service.ts`: consultas de stock por producto, lotes ordenados por `purchasedAt ASC`

### 1C — Productos + Compras
**Objetivo**: CRUD completo de productos (simples, mixes, promos) y registro de compras con lotes.

- [ ] `routes/products.ts`: GET (list + detail), POST, PUT, DELETE (soft)
- [ ] `routes/products.ts`: sub-rutas de variantes (`POST .../variants`, `PUT .../variants/:vid`, `PUT .../variants/:vid/offer`)
- [ ] `routes/purchases.ts`: POST (registrar lote de compra), GET (historial filtrable)
- [ ] Zod schemas para request bodies
- [ ] Todas las queries filtradas por `user_id`

### 1D — Proveedores
**Objetivo**: CRUD simple de proveedores.

- [ ] `routes/suppliers.ts`: GET, POST, PUT, DELETE
- [ ] Solo campo `name` requerido, `phone` y `notes` opcionales

### 1E — Pedidos
**Objetivo**: La feature más compleja. Transacción completa de creación de pedido.

- [ ] `order.service.ts`: validar stock → ejecutar FIFO por producto → transacción DB (insert order + lines + update lots)
- [ ] `routes/orders.ts`: GET (list + detail), POST (crear), PUT `.../status`, DELETE (cancelar con restauración de stock)
- [ ] Manejo de productos compuestos y promociones en la resolución de stock
- [ ] Error detallado cuando hay stock insuficiente (qué producto, cuánto falta)
- [ ] Estados: INGRESADO → PREPARADO → ENTREGADO / ADEUDA_PAGO

### 1F — Gastos + Dashboard
**Objetivo**: Cierre del backend con analíticas.

- [ ] `routes/expenses.ts`: GET (filtrable por mes/año), POST, PUT, DELETE
- [ ] `dashboard.service.ts`: queries de agregación
- [ ] `routes/dashboard.ts`: total vendido, ganancia neta, top productos, tendencia mensual
- [ ] Solo contabiliza pedidos en estado ENTREGADO

---

## Fase 2 — Diseño (OpenPencil)

**Objetivo**: Diseñar TODAS las pantallas antes de escribir una línea de frontend.

- [ ] Instalar OpenPencil (`brew install --cask openpencil`)
- [ ] Conectar MCP server (`http://localhost:3100/mcp`)
- [ ] Diseñar layout raíz (sidebar + contenido)
- [ ] Diseñar login
- [ ] Diseñar dashboard
- [ ] Diseñar lista de productos + detalle + formulario nuevo
- [ ] Diseñar compras
- [ ] Diseñar pedidos: lista, nuevo (el más complejo), detalle con cambio de estado
- [ ] Diseñar gastos + proveedores
- [ ] Exportar a React + Tailwind

---

## Fase 3 — Frontend Foundation

### 3A — Setup
**Objetivo**: Andamiaje del frontend.

- [ ] `apps/web`: Vite + React 19 + TypeScript strict
- [ ] TanStack Router (file-based) + TanStack Query v5
- [ ] Zustand
- [ ] shadcn/ui + Tailwind CSS v4
- [ ] Vitest config para web

### 3B — Design System
**Objetivo**: Implementar el tema RENUX y componentes base.

- [ ] `globals.css`: variables CSS, fuentes (Syne + Space Mono), colores (#FFF5F0, #F57A28)
- [ ] Componentes app: Sidebar, Card, StatCard, EmptyState, PageHeader, StatusBadge, StockBar
- [ ] Skeletons para todos los estados de carga

### 3C — Auth + Layout
**Objetivo**: Login funcional y estructura de navegación.

- [ ] `stores/auth.store.ts`: Zustand con token, login(), logout(), persistencia en localStorage
- [ ] `lib/api.ts`: wrapper fetch con inyección de header `Authorization`
- [ ] `lib/utils.ts`: `formatCurrency()`, `formatDate()`, `formatWeight()`, `cn()`
- [ ] `routes/__root.tsx`: layout raíz con sidebar y guard de auth
- [ ] `routes/login.tsx`: formulario con TanStack Form

---

## Fase 4 — Páginas

### 4A — Dashboard
- [ ] `routes/dashboard.tsx`: stats cards + gráfico de tendencia con Recharts
- [ ] Solo lectura, sin formularios. Valida integración frontend ↔ backend.

### 4B — Productos
- [ ] `routes/products/index.tsx`: lista con filtros (tipo, activo)
- [ ] `routes/products/$productId.tsx`: detalle con stock, variantes, oferta
- [ ] `routes/products/new.tsx`: formulario con TanStack Form (simple → mix → promo)

### 4C — Compras
- [ ] `routes/purchases/index.tsx`: historial + formulario de nueva compra

### 4D — Pedidos
- [ ] `routes/orders/index.tsx`: lista con filtros (estado, fecha)
- [ ] `routes/orders/new.tsx`: formulario más complejo (field arrays, validación de stock inline)
- [ ] `routes/orders/$orderId.tsx`: detalle + botones de transición de estado

### 4E — Gastos + Proveedores
- [ ] `routes/expenses/index.tsx`: CRUD
- [ ] `routes/suppliers/index.tsx`: CRUD

---

## Dependencias entre fases

```
1A ──→ 1B ──→ 1C ──→ 1D
                 │
                 └──→ 1E ──→ 1F
                              │
                 📐 Diseño ←─┘
                              │
                         3A ──→ 3B ──→ 3C
                                        │
                                   4A ──→ 4B ──→ 4C ──→ 4D ──→ 4E
```

- 1A es prerequisito de TODO
- 1B depende de 1A (schema + DB)
- 1C depende de 1B (FIFO + stock)
- 1E depende de 1C (productos + lotes de compra)
- 1F depende de 1E (pedidos ENTREGADO para dashboard)
- 📐 Diseño depende de 1F (API completa para saber qué datos mostrar)
- 3A depende de 📐 (diseños exportados)
- Las páginas (4x) dependen de 3C (layout + auth)

# AGENTS.md — RENUX

> Este archivo es la fuente de verdad única para cualquier agente de IA que construya este proyecto.
> Leerlo completo antes de escribir cualquier línea de código. Seguirlo estrictamente.

---

## 1. Qué es RENUX

RENUX es un sistema de gestión interno para un pequeño negocio familiar dedicado a la venta de frutos secos y mixes personalizados. Gestiona inventario, compras, pedidos, gastos operativos, promociones y análisis de rentabilidad.

Existen dos usuarios con datos aislados (multi-tenancy): un usuario admin para uso real del negocio, y un usuario demo con datos de ejemplo para mostrar en el portfolio. Ambos tienen los mismos privilegios pero ven y manipulan solo sus propios datos. No es un SaaS.

La motivación secundaria es el valor como portfolio: el proyecto debe demostrar arquitectura fullstack limpia, lógica de negocio real (costeo FIFO, productos compuestos, variantes de precio, máquina de estados de pedidos) y una UI pulida y distintiva — no un CRUD genérico.

---

## 2. Qué hace RENUX

- **Auth:** Login con usuario + contraseña. Sesión basada en JWT. Sin flujo de registro. Dos usuarios creados en el seed: admin (datos reales) y demo (datos de ejemplo para portfolio). Ambos con idénticos privilegios pero datos aislados (multi-tenancy).
- **Productos:** Crear, editar y desactivar productos simples y compuestos. Los productos se venden por peso (kg) o por unidad. Cada producto tiene múltiples variantes de precio (ej. 1kg / 500g / 250g). Una variante por producto puede marcarse en oferta con un precio promocional temporal.
- **Inventario:** El stock se rastrea por producto mediante lotes de compra. Cada lote almacena cantidad y costo unitario al momento de la compra. El stock se consume usando lógica FIFO en cada venta.
- **Compras:** Registrar ingreso de mercadería para un producto, creando un nuevo lote con cantidad y costo. Asociación opcional a un proveedor.
- **Productos compuestos (mixes):** Productos formados por otros productos simples con cantidades definidas por componente. No tienen stock propio — el stock se consume de los componentes al vender. El costo se calcula a partir del costo FIFO de los componentes.
- **Promociones:** Bundles con nombre creados por el administrador (ej. "Promo Mundial"). Contienen una lista de productos simples o compuestos con cantidades definidas, vendidos a un precio especial definido por el administrador. Se comportan igual que los productos compuestos en términos de stock y cálculo de costo.
- **Pedidos:** Pedidos con múltiples líneas que incluyen productos, mixes y promociones. Cantidad por línea. Descuento opcional (porcentaje o monto fijo) aplicado al total. Cuatro estados con transiciones manuales.
- **Gastos operativos:** Registrar gastos no relacionados al inventario (packaging, envíos, general). Afectan el cálculo de ganancia neta mensual.
- **Dashboard:** Analíticas mensuales — total vendido, ganancia neta, productos más vendidos por ingreso, tendencia mensual. Filtrable por mes y año. Gráficos de tendencia mensual.
- **Ofertas:** Una variante de precio de un producto puede marcarse temporalmente en oferta con un precio rebajado. La oferta permanece activa hasta ser desactivada manualmente.
- **Multi-tenancy:** Cada usuario ve y manipula solo sus propios datos. Las tablas principales (products, orders, expenses, purchaseLots) incluyen `user_id`. Todas las queries filtran por el usuario autenticado.

---

## 3. Qué NO hace RENUX

- ❌ Sin soporte multi-usuario — existen exactamente dos usuarios con datos aislados, creados en el seed. Sin registro público.
- ❌ Sin cuentas de clientes ni interfaz pública
- ❌ Sin procesamiento de pagos ni integración con MercadoPago (alcance futuro)
- ❌ Sin reorden automático ni notificaciones de stock bajo
- ❌ Sin historial de precios — el precio actual de la variante se guarda en la línea del pedido al momento de la venta
- ❌ Sin escaneo de código de barras
- ❌ Sin app móvil — solo web, desktop y tablet como primarios
- ❌ Sin portal de proveedores ni órdenes de compra enviadas a proveedores
- ❌ Sin sincronización multi-dispositivo en tiempo real (usuario único, sin conflicto)
- ❌ Sin log de auditoría ni historial de cambios
- ❌ Sin exportación a PDF o Excel en v1
- ❌ Sin registro de merma ni pérdida de stock

---

## 4. Máquina de estados de pedidos

Los pedidos tienen exactamente cuatro estados con transiciones manuales:

```
INGRESADO → PREPARADO → ENTREGADO
                      ↘ ADEUDA_PAGO
```

- **INGRESADO:** Pedido registrado. El stock se descuenta inmediatamente al crear el pedido.
- **PREPARADO:** Pedido en preparación. Sin cambio adicional de stock.
- **ENTREGADO:** Pedido entregado y pagado. La ganancia se contabiliza solo desde este estado.
- **ADEUDA_PAGO:** Pedido entregado pero con pago pendiente. La ganancia NO se contabiliza hasta que se pase manualmente a ENTREGADO.

Las transiciones de estado son siempre manuales. Sin progresión automática.

El stock se descuenta al crear el pedido (INGRESADO). Si el stock es insuficiente para cualquier línea, el pedido completo se rechaza con un error descriptivo que indica qué producto falta y cuánto.

---

## 5. Cálculo de costo FIFO

Cada línea de venta calcula su costo usando FIFO contra los lotes de compra de cada producto involucrado.

Para un producto simple:
- Consumir los lotes más antiguos primero hasta satisfacer la cantidad
- Costo promedio ponderado = suma de (costo_lote × cantidad_consumida) / cantidad_total

Para un producto compuesto (mix) o promoción:
- Por cada componente, ejecutar FIFO de forma independiente
- Costo total = suma del costo FIFO de cada componente
- El precio de venta es el definido por el administrador para el mix/promo, no se deriva de los componentes

Ganancia por línea de pedido = (precio_venta × cantidad) - costo_fifo_total
La ganancia se contabiliza solo cuando el estado del pedido = ENTREGADO.

---

## 6. Variantes de precio

Todo producto (simple, mix o promoción) tiene una o más variantes de precio. Cada variante tiene:
- Una etiqueta (ej. "1 kg", "500 g", "250 g", "Unidad")
- Un valor de cantidad en la unidad del producto (kg o unidades)
- Un precio base
- Un precio de oferta opcional (nullable) — cuando está definido, se usa en lugar del precio base
- Un booleano `oferta_activa`

Al crear una línea de pedido, el usuario selecciona el producto Y la variante. El precio al momento de la venta se guarda en la línea del pedido (nunca se recalcula desde los precios actuales).

Para productos vendidos por peso: si un cliente pide una cantidad que no coincide exactamente con ninguna variante, el usuario selecciona manualmente la variante más cercana e ingresa la cantidad real. El sistema no auto-selecciona variantes.

---

## 7. Stack tecnológico

### Frontend

| Capa | Elección |
|---|---|
| Framework | React 19 + TypeScript (strict) |
| Build tool | Vite |
| Router | TanStack Router (file-based routing) |
| Estado del servidor | TanStack Query v5 |
| Estado del cliente | Zustand |
| Formularios | TanStack Form v0 + adaptador Zod |
| Validación | Zod |
| Componentes UI | shadcn/ui (personalizado según design system) |
| Estilos | Tailwind CSS v4 |
| Gráficos | Recharts |
| Lint + Formato | Biome |
| Testing | Vitest |
| Package manager | pnpm (siempre) |

### Backend

| Capa | Elección |
|---|---|
| Runtime | Node.js 22+ |
| Framework | Hono |
| ORM | Drizzle ORM |
| Base de datos | PostgreSQL 16 (Docker Compose) |
| Auth | JWT (jsonwebtoken) — 2 usuarios |
| Validación | Zod (schemas compartidos con frontend donde sea posible) |
| Hash de contraseña | bcryptjs |
| Testing | Vitest |

### Compartido

- Los schemas Zod se definen una sola vez e importan tanto en frontend como backend donde sea posible
- Estructura de monorepo con `apps/web` y `apps/api` bajo un workspace pnpm único
- Sin Next.js. Sin Prisma. Sin Express.
- Docker Compose para desarrollo local (`docker compose up -d`)

---

## 8. Uso de TanStack Form

**Todos los formularios del proyecto usan TanStack Form.** No usar react-hook-form en ningún formulario.

TanStack Form se integra con Zod usando el paquete `@tanstack/zod-form-adapter`.

### Patrón base de formulario

```typescript
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'

const schema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  precio: z.number().positive('El precio debe ser positivo'),
})

function MiFormulario() {
  const form = useForm({
    defaultValues: { nombre: '', precio: 0 },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      // llamar a la API
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <form.Field name="nombre">
        {(field) => (
          <div>
            <label htmlFor={field.name}>Nombre</label>
            <input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="font-mono text-[11px] text-red-500">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
```

### Formulario de nuevo pedido (caso especial)

El formulario de pedido maneja una lista dinámica de líneas. Usar `form.Field` con `mode="array"` para la lista de líneas:

```typescript
const pedidoSchema = z.object({
  clienteNombre: z.string().optional(),
  descuentoTipo: z.enum(['porcentaje', 'fijo']).optional(),
  descuentoValor: z.number().min(0).optional(),
  notas: z.string().optional(),
  lineas: z.array(z.object({
    productoId: z.number({ required_error: 'Seleccioná un producto' }),
    varianteId: z.number({ required_error: 'Seleccioná una variante' }),
    cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  })).min(1, 'El pedido debe tener al menos una línea'),
})

// En el componente:
<form.Field name="lineas" mode="array">
  {(field) => (
    <>
      {field.state.value.map((_, i) => (
        <LineaPedido key={i} form={form} index={i} onRemove={() => field.removeValue(i)} />
      ))}
      <button type="button" onClick={() => field.pushValue({ productoId: 0, varianteId: 0, cantidad: 1 })}>
        + Agregar línea
      </button>
    </>
  )}
</form.Field>
```

### Validación de campos con shadcn/ui

Envolver los componentes de shadcn con los handlers de TanStack Form:

```typescript
<form.Field name="descripcion" validators={{ onChange: z.string().min(1) }}>
  {(field) => (
    <div className="space-y-1">
      <label htmlFor={field.name} className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
        Descripción
      </label>
      <Input
        id={field.name}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        className={field.state.meta.errors.length > 0 ? 'border-red-400' : ''}
      />
      {field.state.meta.errors.length > 0 && (
        <p className="font-mono text-[11px] text-red-500">❌ {field.state.meta.errors[0]}</p>
      )}
    </div>
  )}
</form.Field>
```

### Reglas generales de formularios

- Errores siempre inline debajo del campo — nunca en toast
- Labels siempre visibles arriba del campo — nunca como placeholder
- El botón de submit muestra estado de carga con `form.Subscribe`
- Ancho máximo de formularios: `max-w-xl` (448px) — nunca full-width
- Validación `onChange` para feedback inmediato, `onSubmit` como validación final

---

## 9. Schema de base de datos

Definir todas las tablas en `apps/api/src/db/schema.ts` usando sintaxis de Drizzle ORM.

```typescript
// ─── Usuarios ─────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           serial('id').primaryKey(),
  username:     varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

// ─── Proveedores ──────────────────────────────────────────────────────────────
export const suppliers = pgTable('suppliers', {
  id:        serial('id').primaryKey(),
  name:      varchar('name', { length: 100 }).notNull(),
  phone:     varchar('phone', { length: 30 }),
  notes:     text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Productos ────────────────────────────────────────────────────────────────
export const productTypeEnum = pgEnum('product_type', ['simple', 'mix', 'promotion']);
export const unitEnum = pgEnum('unit', ['kg', 'unit']);

export const products = pgTable('products', {
  id:        serial('id').primaryKey(),
  userId:    integer('user_id').notNull().references(() => users.id),
  name:      varchar('name', { length: 100 }).notNull(),
  type:      productTypeEnum('type').notNull().default('simple'),
  unit:      unitEnum('unit').notNull().default('kg'),
  active:    boolean('active').notNull().default(true),
  notes:     text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Variantes de precio ──────────────────────────────────────────────────────
export const priceVariants = pgTable('price_variants', {
  id:          serial('id').primaryKey(),
  productId:   integer('product_id').notNull().references(() => products.id),
  label:       varchar('label', { length: 50 }).notNull(),    // "1 kg", "500 g", "Unidad"
  quantity:    numeric('quantity', { precision: 10, scale: 3 }).notNull(), // cantidad en la unidad del producto
  basePrice:   numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  offerPrice:  numeric('offer_price', { precision: 10, scale: 2 }),        // null = sin oferta
  offerActive: boolean('offer_active').notNull().default(false),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─── Componentes de productos compuestos ─────────────────────────────────────
// Usado tanto para mixes como para promociones
export const compositeComponents = pgTable('composite_components', {
  id:          serial('id').primaryKey(),
  parentId:    integer('parent_id').notNull().references(() => products.id),    // el mix o la promo
  componentId: integer('component_id').notNull().references(() => products.id), // debe ser simple
  quantity:    numeric('quantity', { precision: 10, scale: 3 }).notNull(),      // en la unidad del componente
});

// ─── Lotes de compra ──────────────────────────────────────────────────────────
export const purchaseLots = pgTable('purchase_lots', {
  id:              serial('id').primaryKey(),
  userId:          integer('user_id').notNull().references(() => users.id),
  productId:       integer('product_id').notNull().references(() => products.id),
  supplierId:      integer('supplier_id').references(() => suppliers.id),
  quantityInitial: numeric('quantity_initial', { precision: 10, scale: 3 }).notNull(),
  quantityLeft:    numeric('quantity_left', { precision: 10, scale: 3 }).notNull(),
  unitCost:        numeric('unit_cost', { precision: 10, scale: 2 }).notNull(),
  purchasedAt:     timestamp('purchased_at').defaultNow().notNull(),
  notes:           text('notes'),
});

// ─── Pedidos ──────────────────────────────────────────────────────────────────
export const orderStatusEnum = pgEnum('order_status', [
  'INGRESADO', 'PREPARADO', 'ENTREGADO', 'ADEUDA_PAGO'
]);

export const orders = pgTable('orders', {
  id:             serial('id').primaryKey(),
  userId:         integer('user_id').notNull().references(() => users.id),
  customerName:   varchar('customer_name', { length: 100 }),
  status:         orderStatusEnum('status').notNull().default('INGRESADO'),
  discountType:   varchar('discount_type', { length: 10 }),   // 'porcentaje' | 'fijo' | null
  discountValue:  numeric('discount_value', { precision: 10, scale: 2 }),
  subtotal:       numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  total:          numeric('total', { precision: 10, scale: 2 }).notNull(),
  totalCost:      numeric('total_cost', { precision: 10, scale: 2 }).notNull(),
  notes:          text('notes'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  deliveredAt:    timestamp('delivered_at'), // se setea cuando status → ENTREGADO
});

// ─── Líneas de pedido ─────────────────────────────────────────────────────────
export const orderLines = pgTable('order_lines', {
  id:             serial('id').primaryKey(),
  orderId:        integer('order_id').notNull().references(() => orders.id),
  productId:      integer('product_id').notNull().references(() => products.id),
  priceVariantId: integer('price_variant_id').notNull().references(() => priceVariants.id),
  quantity:       numeric('quantity', { precision: 10, scale: 3 }).notNull(), // número de variantes pedidas
  unitPrice:      numeric('unit_price', { precision: 10, scale: 2 }).notNull(), // precio al momento de la venta
  unitCost:       numeric('unit_cost', { precision: 10, scale: 2 }).notNull(),  // costo FIFO al momento de la venta
  lineTotal:      numeric('line_total', { precision: 10, scale: 2 }).notNull(),
  lineCost:       numeric('line_cost', { precision: 10, scale: 2 }).notNull(),
});

// ─── Gastos operativos ────────────────────────────────────────────────────────
export const expenses = pgTable('expenses', {
  id:          serial('id').primaryKey(),
  userId:      integer('user_id').notNull().references(() => users.id),
  description: varchar('description', { length: 150 }).notNull(),
  amount:      numeric('amount', { precision: 10, scale: 2 }).notNull(),
  category:    varchar('category', { length: 50 }), // 'packaging', 'envios', 'general'
  occurredAt:  timestamp('occurred_at').defaultNow().notNull(),
  notes:       text('notes'),
});
```

---

## 10. Endpoints de la API (Hono)

Todas las rutas tienen el prefijo `/api`. Todas requieren un JWT válido en el header `Authorization: Bearer <token>` excepto `POST /api/auth/login`.

### Auth
```
POST   /api/auth/login          { username, password } → { token, expiresAt }
POST   /api/auth/logout         (invalidación solo del lado del cliente)
GET    /api/auth/me             → { username }
```

### Productos
```
GET    /api/products            ?type=simple|mix|promotion&active=true|false
GET    /api/products/:id        → producto con variantes y componentes
POST   /api/products            crear producto (con variantes y componentes en el body)
PUT    /api/products/:id        actualizar metadatos del producto
DELETE /api/products/:id        soft delete (activo = false)

POST   /api/products/:id/variants              agregar variante de precio
PUT    /api/products/:id/variants/:vid         actualizar variante (precio, etiqueta, cantidad)
DELETE /api/products/:id/variants/:vid         eliminar variante
PUT    /api/products/:id/variants/:vid/offer   { offerPrice, offerActive }
```

### Inventario
```
GET    /api/products/:id/stock   → { totalStock, lots[] }
POST   /api/purchases            registrar nuevo lote de compra
GET    /api/purchases            ?productId=&from=&to=
```

### Proveedores
```
GET    /api/suppliers
POST   /api/suppliers
PUT    /api/suppliers/:id
DELETE /api/suppliers/:id
```

### Pedidos
```
GET    /api/orders              ?status=&from=&to=&page=&limit=
GET    /api/orders/:id          → pedido con líneas
POST   /api/orders              crear pedido (valida stock, ejecuta FIFO, descuenta stock)
PUT    /api/orders/:id/status   { status } — avanzar máquina de estados
DELETE /api/orders/:id          cancelar pedido (restaura stock) — solo si INGRESADO o PREPARADO
```

### Gastos
```
GET    /api/expenses            ?month=&year=
POST   /api/expenses
PUT    /api/expenses/:id
DELETE /api/expenses/:id
```

### Dashboard
```
GET    /api/dashboard           ?month=&year=
  → {
      totalVendido,           // suma de totales de pedidos (solo ENTREGADO)
      costoTotal,             // suma de costos de pedidos (solo ENTREGADO)
      totalGastos,            // suma de gastos del mes
      gananciaNeta,           // totalVendido - costoTotal - totalGastos
      topProductosPorIngreso: [{ productoId, nombre, ingreso }],
      tendenciaMensual: [{ mes, totalVendido, gananciaNeta }]  // últimos 6 meses
    }
```

---

## 11. Estructura del proyecto backend

```
apps/api/
├── src/
│   ├── index.ts                    # Setup de Hono, middleware, montaje de rutas
│   ├── config.ts                   # Validación de variables de entorno con Zod
│   ├── db/
│   │   ├── schema.ts               # Todas las definiciones de tablas Drizzle
│   │   ├── index.ts                # Instancia del cliente Drizzle
│   │   └── seed.ts                 # Seed de usuarios (admin + demo)
│   ├── middleware/
│   │   ├── auth.ts                 # Middleware de verificación JWT
│   │   └── error-handler.ts        # Manejador global de errores
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── products.ts
│   │   ├── purchases.ts
│   │   ├── suppliers.ts
│   │   ├── orders.ts
│   │   ├── expenses.ts
│   │   └── dashboard.ts
│   ├── services/
│   │   ├── fifo.service.ts         # Lógica de cálculo de costo y descuento de stock FIFO
│   │   ├── order.service.ts        # Creación de pedido: validar stock, ejecutar FIFO, escribir en DB
│   │   ├── stock.service.ts        # Consultas de stock, gestión de lotes
│   │   └── dashboard.service.ts    # Consultas de analíticas
│   ├── schemas/
│   │   └── index.ts                # Schemas Zod para todos los request bodies
│   └── errors.ts                   # Clase AppError con campo statusCode
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

---

## 12. Estructura del proyecto frontend

```
apps/web/
├── src/
│   ├── main.tsx
│   ├── routeTree.gen.ts              # Auto-generado por TanStack Router
│   ├── routes/
│   │   ├── __root.tsx                # Layout raíz: verificación auth, sidebar, toast provider
│   │   ├── login.tsx
│   │   ├── index.tsx                 # Redirige a /dashboard
│   │   ├── dashboard.tsx
│   │   ├── products/
│   │   │   ├── index.tsx             # Lista de productos
│   │   │   ├── $productId.tsx        # Detalle de producto + stock + variantes
│   │   │   └── new.tsx
│   │   ├── orders/
│   │   │   ├── index.tsx             # Lista de pedidos con filtros
│   │   │   ├── $orderId.tsx          # Detalle del pedido
│   │   │   └── new.tsx               # Formulario de nuevo pedido
│   │   ├── purchases/
│   │   │   └── index.tsx             # Historial de compras + nueva compra
│   │   ├── expenses/
│   │   │   └── index.tsx
│   │   └── suppliers/
│   │       └── index.tsx
│   ├── components/
│   │   ├── ui/                       # Componentes shadcn/ui (personalizados)
│   │   └── app/
│   │       ├── Sidebar.tsx
│   │       ├── Card.tsx              # Wrapper Card de RENUX
│   │       ├── StatCard.tsx
│   │       ├── EmptyState.tsx
│   │       ├── PageHeader.tsx
│   │       ├── StatusBadge.tsx       # Badge de estado de pedido
│   │       ├── StockBar.tsx          # Indicador visual de stock
│   │       └── skeletons/
│   ├── hooks/
│   │   ├── useAuth.ts                # Estado de auth desde Zustand
│   │   └── api/                      # Un archivo por recurso (useProducts, useOrders, etc.)
│   ├── stores/
│   │   └── auth.store.ts             # Zustand: token, username, login(), logout()
│   ├── lib/
│   │   ├── api.ts                    # Wrapper de fetch con base URL + inyección de header auth
│   │   ├── utils.ts                  # cn(), formatCurrency(), formatDate(), formatWeight()
│   │   └── schemas.ts                # Schemas Zod (compartidos o solo frontend)
│   └── styles/
│       └── globals.css               # Tailwind + variables CSS de shadcn (tema RENUX)
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 13. Resumen del sistema de diseño

Leer `06-design-system.md` completo antes de tocar cualquier componente. Reglas clave:

- **Fondo:** siempre `#FFF5F0` (crema) — nunca blanco como base
- **Superficies:** `#FFFFFF` para cards, sidebar, modales — genera jerarquía sin sombras
- **Color primario:** `#F57A28` (naranja RENUX) — botones, nav activo, valores monetarios
- **Tipografía:** Syne para títulos y números, Space Mono para labels de UI y cuerpo de texto
- **Bordes:** `border-orange-100` por defecto, `border-orange-200` visible, nunca `border-gray-200`
- **Loading:** siempre skeletons — nunca spinners centrados
- **Errores:** siempre inline debajo del campo — nunca en toast
- **Modales:** max-w-md o max-w-lg — nunca pantalla completa
- **Tablas:** números alineados a la derecha, hover en filas clickeables, `font-mono text-xs`

---

## 14. Especificación del servicio FIFO

`fifo.service.ts` es el módulo más crítico. Debe implementarse y probarse antes de cualquier lógica de creación de pedidos.

```typescript
// Tipos principales
interface FifoConsumption {
  lotId: number
  quantityConsumed: number
  unitCost: number
}

interface FifoResult {
  consumptions: FifoConsumption[]
  totalCost: number         // suma de (cantidad × costoPorUnidad) en todos los lotes consumidos
  averageUnitCost: number   // totalCost / cantidadTotalConsumida
  sufficient: boolean       // false si no hay suficiente stock
  shortfall: number         // cuánto faltó (0 si sufficient = true)
}

// Función principal
function calculateFifo(
  lots: { id: number; quantityLeft: number; unitCost: number }[], // ordenados por purchasedAt ASC
  quantityNeeded: number
): FifoResult
```

Reglas:
- Los lotes deben estar ordenados por `purchasedAt ASC` antes de pasarlos — primero los más antiguos
- Nunca mutar los lotes en memoria — devolver los consumos como lista separada
- El descuento real en la DB ocurre en `order.service.ts` usando los consumos devueltos
- Si `sufficient = false`, el pedido completo debe rechazarse — nunca descontar parcialmente

Para productos compuestos y promociones:
- Ejecutar `calculateFifo` de forma independiente para cada componente
- Si algún componente devuelve `sufficient = false`, recolectar todos los faltantes y rechazar con un error detallado listando cada producto insuficiente

---

## 15. Flujo de creación de pedido

Es la operación más compleja. Debe implementarse como una única transacción de base de datos.

```
1. Validar el request body con Zod
2. Por cada línea del pedido:
   a. Obtener producto y variante de precio — verificar que ambos existan y estén activos
   b. Resolver los productos reales a los que descontar stock:
      - simple → [el producto mismo]
      - mix/promoción → [todos sus componentes]
   c. Calcular la cantidad total necesaria por producto simple en todas las líneas
      (un producto puede aparecer en múltiples líneas o como componente de múltiples compuestos)
3. Agregar cantidad total necesaria por ID de producto simple
4. Por cada producto simple, obtener sus lotes (ordenados por purchasedAt ASC)
5. Ejecutar calculateFifo por cada producto simple
6. Si CUALQUIER producto tiene sufficient = false → lanzar error con detalles, abortar transacción
7. Iniciar transacción DB:
   a. Insertar registro del pedido (calcular subtotal, descuentoAplicado, total, costoTotal)
   b. Insertar líneas del pedido (con unitPrice y unitCost capturados en este momento)
   c. Actualizar purchaseLots.quantityLeft por cada consumo
8. Devolver el pedido creado con sus líneas
```

---

## 16. Flujo de auth

Dos usuarios con idénticos privilegios pero datos aislados. Sin endpoint de registro.

Al primer deploy, ejecutar `seed.ts` que inserta ambos usuarios con contraseñas hasheadas.

```typescript
// seed.ts
const adminPassword = process.env.ADMIN_PASSWORD // definido en .env
const demoPassword = process.env.DEMO_PASSWORD   // definido en .env
const adminHash = await bcrypt.hash(adminPassword, 10)
const demoHash = await bcrypt.hash(demoPassword, 10)
await db.insert(users).values([
  { username: 'admin', passwordHash: adminHash },
  { username: 'demo',  passwordHash: demoHash  },
])
// El seed también inserta datos de ejemplo para el usuario demo.
```

El login devuelve un JWT firmado con `process.env.JWT_SECRET` con vencimiento de 7 días.

El frontend guarda el token en Zustand (memoria) + localStorage para persistencia. Al cargar la app, si hay token en localStorage, restaurarlo a Zustand y validar con `GET /api/auth/me`. Si la validación falla, limpiar token y redirigir a `/login`.

TanStack Router: proteger todas las rutas excepto `/login` con un guard `beforeLoad` que verifica el estado de auth en Zustand.

---

## 17. Setup del monorepo

```
renux/
├── apps/
│   ├── web/          # Frontend React
│   └── api/          # Backend Hono
├── docker-compose.yml   # PostgreSQL 16
├── package.json      # Raíz del workspace pnpm
└── pnpm-workspace.yaml
```

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: renux2026
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
```

```json
// root package.json
{
  "name": "renux",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter web dev",
    "dev:api": "pnpm --filter api dev",
    "dev": "concurrently \"pnpm dev:api\" \"pnpm dev:web\""
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
```

```json
// root package.json
{
  "name": "renux",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter web dev",
    "dev:api": "pnpm --filter api dev",
    "dev": "concurrently \"pnpm dev:api\" \"pnpm dev:web\""
  }
}
```

---

## 18. Variables de entorno

```env
# apps/api/.env
DATABASE_URL=postgresql://user:password@localhost:5432/renux
JWT_SECRET=cambiar-por-string-aleatorio
ADMIN_PASSWORD=cambiar-por-contraseña-segura
PORT=3001

# apps/web/.env
VITE_API_URL=http://localhost:3001
```

---

## 19. Orden de construcción

El plan completo de desarrollo está documentado en [`openspec/ROADMAP.md`](openspec/ROADMAP.md). Resumen de fases:

### Fase 1 — Backend
1. **1A — Scaffolding:** Monorepo, Docker, DB + schema (multi-tenant), auth (2 usuarios), seed
2. **1B — FIFO + Stock:** Lógica de costeo probada exhaustivamente, consultas de stock
3. **1C — Productos + Compras:** CRUD completo, variantes, ofertas, lotes de compra
4. **1D — Proveedores:** CRUD simple
5. **1E — Pedidos:** Transacción compleja, estados, cancelación con restauración
6. **1F — Gastos + Dashboard:** Analíticas mensuales

### Fase 2 — Diseño (OpenPencil)
Diseñar todas las pantallas con OpenPencil vía MCP antes de codear frontend.

### Fase 3 — Frontend Foundation
7. **3A — Setup:** Vite + React + TanStack Router + shadcn/ui + Tailwind
8. **3B — Design System:** Tema RENUX, componentes app, skeletons
9. **3C — Auth + Layout:** Login, sidebar, guard de rutas

### Fase 4 — Páginas
10. **4A → 4E:** Dashboard → Productos → Compras → Pedidos → Gastos/Proveedores

Ver `openspec/ROADMAP.md` para el detalle completo de cada fase, sus dependencias, y el orden justificado.

---

## 20. Definition of done

### Backend
- [ ] Todos los endpoints devuelven datos y status codes correctos
- [ ] La lógica FIFO descuenta stock correctamente entre lotes en orden cronológico
- [ ] La creación de pedidos rechaza con error claro cuando algún producto tiene stock insuficiente
- [ ] El descuento de stock de productos compuestos y promociones funciona correctamente
- [ ] El dashboard devuelve cifras mensuales precisas (solo pedidos ENTREGADO para ganancias)
- [ ] JWT protege todas las rutas excepto login
- [ ] Todas las validaciones Zod rechazan input malformado con 400 + mensaje legible
- [ ] La transacción DB hace rollback completo en cualquier error de creación de pedido
- [ ] Sin promise rejections no manejadas
- [ ] Las queries de productos, pedidos, gastos y compras están filtradas por `user_id`

### Frontend
- [ ] El flujo de login funciona y persiste entre recargas de página
- [ ] Todas las páginas respetan el sistema de diseño RENUX (colores, fuentes, componentes)
- [ ] El dashboard muestra estadísticas mensuales correctas con visualizaciones de Recharts
- [ ] El formulario de nuevo pedido valida stock antes del submit y muestra errores inline
- [ ] Las transiciones de estado de pedidos funcionan y actualizan la UI inmediatamente
- [ ] El badge de oferta se muestra en variantes con oferta activa
- [ ] Skeletons visibles durante todos los estados de carga — sin spinners
- [ ] Empty states visibles en todas las páginas de listas cuando no hay datos
- [ ] Todos los formularios usan TanStack Form con validación Zod
- [ ] El layout responsive funciona en tablet (sidebar se colapsa por debajo de lg)
- [ ] Sin errores de TypeScript en modo strict

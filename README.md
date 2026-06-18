# Shop Management System

Single-shop retail platform: inventory, POS, billing/invoicing, returns & refunds,
customer management, and online ordering with delivery.

> Architecture, diagrams, and the reasoning behind every major decision live in
> **[`docs/architecture.md`](docs/architecture.md)**. Read it before changing structure.

## Shape

A **modular monolith API** (TypeScript) serving two Next.js frontends, on a single
managed **Supabase** Postgres. Built and run by one person; the north star is **never
lose a sale or transaction**.

```
shop-management-system/
├── apps/
│   ├── api/      # Node/TS modular monolith        → Google Cloud Run
│   │   └── src/modules/  catalog, inventory, customers, orders, billing,
│   │                     payments, pos, fulfillment, notifications, auth
│   ├── admin/    # Next.js staff portal            → Vercel
│   └── web/      # Next.js customer storefront      → Vercel
├── packages/
│   └── shared/   # Money type + shared DTOs (used by all three apps)
└── docs/
    └── architecture.md   # arc42 doc + C4 diagrams + ADRs
```

## Module rules (keep the monolith modular — ADR-002)

- Modules talk to each other through their **public services/interfaces**, never by
  reaching into another module's tables.
- Dependencies point **inward**: `pos`/`billing` may compose `catalog`/`inventory`/
  `orders`/`payments`; the latter don't depend back on them.
- External providers (Stripe, email, Cloud Tasks, future courier) sit behind **ports**
  so the domain stays portable (ADR-005, ADR-008).

## Getting started

```bash
npm install                 # installs all workspaces
cp .env.example .env         # fill in DATABASE_URL (Supabase pooler!), Stripe, email, secrets
npm run dev:api              # API on :8080
npm run dev:admin            # admin portal on :3001
npm run dev:web              # storefront on :3000
```

> `DATABASE_URL` must be the **Supabase transaction-mode pooler** endpoint (port 6543),
> not the direct connection — Cloud Run + serverless connection fan-out will otherwise
> exhaust the database (ADR-003).

## Non-negotiables baked into the scaffold

- **Money** is integer minor units everywhere (`packages/shared/src/money.ts`) — never floats (ADR-009).
- **Stock** is reserved with `SELECT … FOR UPDATE` inside the order transaction — overselling is structurally impossible (`inventory.service.ts`, ADR-006).
- **Card payment** is confirmed by Stripe **webhook**, idempotent on the event id — never by the client (`webhook.handler.ts`, ADR-005).
- **Background work** (email) runs via Cloud Tasks with retries — a down provider is a delay, not a lost order (ADR-004).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Single-shop retail management system: inventory, POS, billing/invoicing, returns &
refunds, customer management, and online ordering with delivery. Built and run by one
person. The north star is **never lose a sale or transaction** — correctness and
durability of money and stock outrank everything else.

This is an early **scaffold**: structure, schema, and the integrity-critical paths are
real; most module bodies are documented stubs marked `TODO`.

**`docs/architecture.md` is the source of truth** for design and the reasoning (arc42 doc
with C4 diagrams and ADRs). Read it before changing structure, and update its ADRs when a
significant decision changes. `docs/architecture.docx` is a generated stakeholder export —
do not hand-edit it; regenerate from the Markdown (see below).

## Commands

npm workspaces monorepo (Node ≥ 22, no pnpm). From the repo root:

```bash
npm install            # install all workspaces
npm run dev:api        # API on :8080  (node --watch, strips TS types directly)
npm run dev:admin      # admin portal on :3001
npm run dev:web        # storefront on :3000
npm run build          # build all workspaces
npm run typecheck      # tsc --noEmit across all workspaces
npm run lint           # lint across all workspaces (when configured)

# scope a command to one workspace:
npm run <script> --workspace apps/api

npm run migrate --workspace apps/api   # apply SQL migrations (apps/api/src/db/migrations)
```

No test runner is wired up yet. When adding one, prioritize tests for the invariants
below — they are the reason this system exists.

## Architecture (the big picture)

Three deployables + one database, all TypeScript:

- **`apps/api`** — a **modular monolith** (Fastify, Node/TS) → Google Cloud Run. This is
  deliberately *not* microservices (ADR-002). All domain logic lives here, split into
  modules under `src/modules/`: `catalog, inventory, customers, orders, billing, payments,
  pos, fulfillment, notifications, auth`.
- **`apps/admin`** — Next.js staff portal → Vercel.
- **`apps/web`** — Next.js customer storefront → Vercel.
- **`packages/shared`** — `Money` type + cross-app DTOs, imported as `@shop/shared` by all
  three apps.
- **Database** — PostgreSQL on **Supabase**, reached through the Supavisor pooler.

The frontends hold no business logic; they call the API over REST/JSON. Async side-effects
(email, post-payment work) go through **Cloud Tasks** (HTTP push back to the same API) —
there is no message broker and no separate worker process (ADR-004).

### Module boundary rules (keep the monolith modular)

- Modules communicate through each other's **public services/interfaces**, never by
  reading another module's tables.
- Dependencies point **inward**: `pos` and `billing` may compose `catalog`/`inventory`/
  `orders`/`payments`; those lower modules must not depend back on them.
- External providers (Stripe, email, Cloud Tasks, the future courier) sit behind **ports/
  adapters** so the domain stays portable. Follow the `PaymentProvider` pattern
  (`modules/payments/payment-provider.ts` + `stripe.adapter.ts` + `cod.adapter.ts`) when
  integrating anything new; the `fulfillment` module is the reserved seam for a courier.

### Invariants that must not be broken

These are load-bearing — the whole project is justified by them. Preserve them in any change:

1. **Money is integer minor units, never floats** (ADR-009). Use the `Money` type and
   helpers in `packages/shared/src/money.ts`; format to decimals only at the display edge.
   DB columns are `*_minor BIGINT` + a currency column.
2. **Stock is reserved transactionally with row locks** (ADR-006). Decrement happens inside
   the order-creating transaction via `SELECT … FOR UPDATE` (`modules/inventory/
   inventory.service.ts`), with rows locked in a stable order to avoid deadlocks. Never do
   read-then-write stock checks in application memory. The `CHECK (on_hand >= 0)` constraint
   is the final backstop. Cancellations/returns/timeout-sweeps restore stock the same way.
3. **Card payment is confirmed by the Stripe webhook, never the client** (ADR-005, §6.1).
   An order is marked `paid` only in `modules/payments/webhook.handler.ts`, which is
   **idempotent** on the Stripe event id (UNIQUE `(provider, provider_event)` +
   `ON CONFLICT DO NOTHING`). Order creation also carries a client idempotency key.
4. **Run all DB writes that must be atomic through `withTransaction`**
   (`apps/api/src/db/pool.ts`). Order + stock + payment-state changes belong in one
   transaction.

### Database connection (important)

`DATABASE_URL` must point at the **Supabase transaction-mode pooler (port 6543)**, not the
direct connection — Cloud Run's serverless fan-out otherwise exhausts Postgres connections
(ADR-003). Transaction pooling means **no session-scoped state across queries**: avoid
server-side prepared statements and `LISTEN`/`NOTIFY`. Keep the per-instance `pg` pool small.

### Auth

Two separate identity realms (ADR-007): **staff** (provisioned, RBAC: `owner`/`cashier`,
gates refunds/price/stock edits) and **customers** (self-service). Sessions are stateless so
the API scales horizontally. Use a vetted library; never hand-roll crypto.

## Regenerating the stakeholder .docx

`docs/architecture.docx` is generated from `docs/architecture.md`. The build tooling
(converter + Mermaid rendering via `mermaid-cli`) lives in `/tmp/docx-build` and is not
committed. After editing the Markdown, re-extract/re-render the Mermaid diagrams and re-run
the converter, then validate with the `docx` skill's `validate.py`. Treat the Markdown as
canonical.

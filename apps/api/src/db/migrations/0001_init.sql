-- Initial schema. Money is stored as integer minor units (ADR-009): *_minor columns
-- are BIGINT cents, paired with a currency code. No floating point for money, ever.

CREATE TABLE products (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku          TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    price_minor  BIGINT NOT NULL CHECK (price_minor >= 0),
    currency     TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock is its own row so it can be locked independently (SELECT ... FOR UPDATE).
-- The CHECK makes overselling impossible even if application logic has a bug (ADR-006).
CREATE TABLE stock (
    product_id    UUID PRIMARY KEY REFERENCES products(id),
    on_hand       INTEGER NOT NULL CHECK (on_hand >= 0),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE staff (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('owner', 'cashier')),
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel         TEXT NOT NULL CHECK (channel IN ('online', 'pos')),
    status          TEXT NOT NULL,
    customer_id     UUID REFERENCES customers(id),
    total_minor     BIGINT NOT NULL,
    currency        TEXT NOT NULL,
    -- Client-supplied idempotency key prevents duplicate orders on retry (ADR-004 §Resilience).
    idempotency_key TEXT UNIQUE,
    reserved_until  TIMESTAMPTZ, -- card orders: when an unpaid reservation expires (ADR-006)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_lines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id),
    product_id  UUID NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    unit_minor  BIGINT NOT NULL,
    currency    TEXT NOT NULL
);

-- Idempotent payment event log: dedup on the provider's event id so a redelivered
-- Stripe webhook never double-processes (ADR-005, §6.1).
CREATE TABLE payment_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    provider        TEXT NOT NULL,           -- 'stripe' | 'cash_on_delivery'
    provider_event  TEXT,                    -- Stripe event id; NULL for COD
    kind            TEXT NOT NULL,           -- 'authorized' | 'paid' | 'refunded'
    amount_minor    BIGINT NOT NULL,
    currency        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_event)
);

-- Append-only audit log for money/stock-affecting actions (§8 Security).
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    actor_type  TEXT NOT NULL,   -- 'staff' | 'customer' | 'system'
    actor_id    UUID,
    action      TEXT NOT NULL,   -- e.g. 'refund.issued', 'stock.adjusted', 'price.changed'
    detail      JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

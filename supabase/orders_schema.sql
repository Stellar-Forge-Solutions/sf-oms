-- ============================================================
-- Stellar Forge ORDERS: run once in the Supabase SQL editor.
-- It lives in the SAME project as sf-billing and re-uses its
-- shops / entitlements tables and the shop_can_write() function.
--
-- ASSUMPTIONS (taken from the sf-billing code, please verify):
--   shops(id, owner_id, status, name, email, mobile, whatsapp, address,
--         gst_no, website, tagline, thank_you, logo_path, paper_width ...)
--   entitlements(shop_id, product, trial_ends_at, paid_until)
--   shop_can_write(p_shop uuid, p_product text) returns boolean
-- If sf-billing already has a helper that returns "the current user's shop"
-- (e.g. for staff logins), put its logic inside my_shop_id() below.
-- ============================================================

-- 1) Small additions to shared tables ------------------------
alter table shops        add column if not exists signup_product text default 'billing';
alter table entitlements add column if not exists plan text default 'basic';   -- 'basic' | 'pro'

-- 2) Helper: which shop does the signed-in user belong to ----
create or replace function my_shop_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from shops where owner_id = auth.uid() limit 1
$$;

-- 3) Per-shop order settings ---------------------------------
create table if not exists order_settings (
  shop_id        uuid primary key references shops(id) on delete cascade,
  stages         jsonb  not null default '[]',      -- ordered [{key,label}], max 7
  category_label text   not null default 'Category',
  notify_channel text   not null default 'whatsapp' check (notify_channel in ('whatsapp','email','both')),
  fields         jsonb  not null default '{}',      -- which fields show on the new-order page
  tax            jsonb  not null default '{}',      -- {cgst:{on,pct}, sgst:{on,pct}, igst:{on,pct}}
  printer_mode   text   not null default 'thermal' check (printer_mode in ('thermal','normal')),
  order_prefix   text   not null default 'ORD-',
  custom_url     text,                              -- Pro
  brand_color    text,                              -- Pro
  hide_powered   boolean not null default false,    -- Pro
  updated_at     timestamptz default now()
);

-- 4) Products -------------------------------------------------
create table if not exists order_products (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  name        text not null,
  category    text,
  unit        text,
  unit_price  numeric(12,2) not null default 0,
  cgst        numeric(6,2),            -- percent, optional per-product override
  sgst        numeric(6,2),
  igst        numeric(6,2),
  total_price numeric(12,2),           -- unit price + product tax (informational)
  created_at  timestamptz default now()
);
create unique index if not exists order_products_name_uq on order_products (shop_id, lower(name));

-- 5) Orders ---------------------------------------------------
create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops(id) on delete cascade,
  order_no         int,
  token            text not null unique default replace(gen_random_uuid()::text, '-', ''),
  customer_name    text not null,
  customer_whatsapp text,
  customer_email   text,
  stage_key        text not null default 'received',
  payment_status   text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','refunded')),
  amount_paid      numeric(12,2) not null default 0,
  subtotal         numeric(12,2) not null default 0,
  cgst_amt         numeric(12,2) not null default 0,
  sgst_amt         numeric(12,2) not null default 0,
  igst_amt         numeric(12,2) not null default 0,
  tax_total        numeric(12,2) not null default 0,
  freight          numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  notes            text,
  bill_path        text,               -- file in the private 'order-bills' bucket
  bill_source      text check (bill_source in ('generated','uploaded')),
  bill_updated_at  timestamptz,
  created_by       text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists orders_shop_created on orders (shop_id, created_at desc);
create index if not exists orders_shop_stage   on orders (shop_id, stage_key);

create or replace function orders_set_no() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.shop_id::text));
  select coalesce(max(order_no), 0) + 1 into new.order_no from orders where shop_id = new.shop_id;
  return new;
end $$;
drop trigger if exists orders_set_no_t on orders;
create trigger orders_set_no_t before insert on orders for each row execute function orders_set_no();

create table if not exists order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  shop_id     uuid not null references shops(id) on delete cascade,
  product_id  uuid references order_products(id) on delete set null,
  name        text not null,
  category    text,
  description text,
  unit        text,
  quantity    numeric(12,3) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  cgst_pct    numeric(6,2) not null default 0,
  sgst_pct    numeric(6,2) not null default 0,
  igst_pct    numeric(6,2) not null default 0,
  tax_amt     numeric(12,2) not null default 0,
  line_total  numeric(12,2) not null default 0,   -- quantity * unit_price (before tax)
  created_at  timestamptz default now()
);
create index if not exists order_items_order on order_items (order_id);

create table if not exists order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  shop_id    uuid not null references shops(id) on delete cascade,
  stage_key  text not null,
  stage_label text not null,
  note       text,
  created_at timestamptz default now()
);
create index if not exists order_events_order on order_events (order_id, created_at);

-- 6) Row level security: a shop only sees its own rows; writes need an active trial/plan
do $$
declare t text;
begin
  foreach t in array array['order_settings','order_products','orders','order_items','order_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own read" on %I', t);
    execute format('drop policy if exists "own write" on %I', t);
    execute format('create policy "own read" on %I for select using (shop_id = my_shop_id())', t);
    execute format($p$create policy "own write" on %I for all
      using (shop_id = my_shop_id()) with check (shop_id = my_shop_id() and shop_can_write(shop_id, 'orders'))$p$, t);
  end loop;
end $$;

-- 7) Bill files: private bucket, folder = shop id -------------
insert into storage.buckets (id, name, public) values ('order-bills', 'order-bills', false) on conflict do nothing;
drop policy if exists "order-bills own" on storage.objects;
create policy "order-bills own" on storage.objects for all
  using      (bucket_id = 'order-bills' and (storage.foldername(name))[1] = my_shop_id()::text)
  with check (bucket_id = 'order-bills' and (storage.foldername(name))[1] = my_shop_id()::text);

-- 8) Approval flow: when a shop that signed up for ORDERS is approved,
--    start its 15-day trial automatically (same trial rule as billing).
create or replace function orders_start_trial() returns trigger language plpgsql security definer as $$
begin
  if new.status = 'approved' and coalesce(old.status,'') <> 'approved' and new.signup_product = 'orders' then
    insert into entitlements (shop_id, product, trial_ends_at, plan)
    select new.id, 'orders', now() + interval '15 days', 'basic'
    where not exists (select 1 from entitlements where shop_id = new.id and product = 'orders');
  end if;
  return new;
end $$;
drop trigger if exists orders_start_trial_t on shops;
create trigger orders_start_trial_t after update of status on shops for each row execute function orders_start_trial();

-- 9) Activate ORDERS manually for an existing billing shop (example):
-- insert into entitlements (shop_id, product, trial_ends_at, plan)
-- values ('<shop uuid>', 'orders', now() + interval '15 days', 'basic');
-- Upgrade to pro:  update entitlements set plan='pro', paid_until = ... where shop_id='<uuid>' and product='orders';

-- 10) Home page totals, computed in the database (a single API request returns at most 1000 rows)
create or replace function orders_summary(p_from timestamptz, p_to timestamptz)
returns table (stage_key text, n bigint, total numeric, paid numeric)
language sql stable as $$
  select stage_key, count(*), coalesce(sum(total), 0), coalesce(sum(amount_paid), 0)
  from orders
  where shop_id = my_shop_id() and (p_from is null or created_at >= p_from) and (p_to is null or created_at < p_to)
  group by stage_key
$$;

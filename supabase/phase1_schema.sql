create extension if not exists "pgcrypto";

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  country text,
  source_channel text,
  created_at timestamptz not null default now()
);

create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'approved',
  full_name text not null,
  email text unique not null,
  country text,
  phone_country_code text,
  phone_number text,
  tracking_code text unique not null,
  coupon_code text,
  commission_rate numeric(5,2) default 0.60,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  full_name text not null,
  email text not null,
  country text not null,
  phone_country_code text not null,
  phone_number text not null,
  main_channel text not null,
  audience_type text not null,
  notes text not null,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references affiliates(id) on delete set null,
  tracking_code text not null,
  landing_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  clicked_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text unique not null,
  stripe_payment_intent_id text,
  customer_id uuid references customers(id) on delete set null,
  customer_email text,
  customer_name text,
  product_slug text not null,
  product_name text not null,
  affiliate_id uuid references affiliates(id) on delete set null,
  affiliate_code text,
  payment_status text not null,
  fulfillment_status text not null default 'pending_manual',
  amount_total numeric(10,2),
  currency text,
  commission_amount numeric(10,2),
  landing_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  source_metadata jsonb,
  created_at timestamptz not null default now()
);

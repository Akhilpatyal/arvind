create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_name text not null default 'Master Social Confidence eBook',
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  razorpay_signature text,
  payment_status text not null default 'created' check (payment_status in ('created', 'paid', 'failed', 'refunded')),
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed')),
  email_sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_email_idx on public.customers(email);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_razorpay_order_id_idx on public.orders(razorpay_order_id);
create index if not exists orders_payment_status_idx on public.orders(payment_status);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.orders enable row level security;

-- No public RLS policies are required. Vercel functions use the Supabase
-- service role key, which bypasses RLS. Never expose that key in frontend code.

-- Phase 6: premium subscriptions (Razorpay Subscriptions + UPI AutoPay + trial + webhook)
-- 002 ke baad chalao (005/006 ke baad, order: schema, 002, 003, 004, 005, 006, 007)

-- Naye plans: premium monthly/yearly (daily_chat_limit NULL = unlimited)
insert into plans (code, name, price_inr, interval, daily_chat_limit, active) values
  ('premium_monthly','Premium Monthly',149,'month',null,true),
  ('premium_yearly','Premium Yearly',999,'year',null,true)
on conflict (code) do update set name = excluded.name, price_inr = excluded.price_inr,
  interval = excluded.interval, daily_chat_limit = excluded.daily_chat_limit, active = true;

-- Trial plan: planOf() isse unlimited treat karta hai; public listing se bahar (active=false)
insert into plans (code, name, price_inr, interval, daily_chat_limit, active) values
  ('trial','Free Trial',0,'once',null,false)
on conflict (code) do update set name = excluded.name, price_inr = excluded.price_inr,
  interval = excluded.interval, daily_chat_limit = excluded.daily_chat_limit, active = false;

-- Purana one-time 'premium' plan (₹199) ab subscriptions se supersede hai
update plans set active = false where code = 'premium';

-- Subscriptions lifecycle columns
alter table subscriptions add column if not exists provider_subscription_id text;
alter table subscriptions add column if not exists trial_end timestamptz;
alter table subscriptions add column if not exists current_period_start timestamptz;
alter table subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table subscriptions add column if not exists past_due_since timestamptz;
create unique index if not exists subscriptions_provider_sub_uidx
  on subscriptions (provider_subscription_id) where provider_subscription_id is not null;
create index if not exists subscriptions_user_created_idx on subscriptions (user_id, created_at desc);
-- status values (text, koi enum nahi): created | trialing | active | past_due | cancelled | expired

-- Webhook idempotency + audit log (server-only: RLS on, koi policy nahi — 003 wala pattern)
create table if not exists webhook_events (
  id bigserial primary key,
  provider text not null default 'razorpay',
  event_id text unique,
  event_type text,
  payload jsonb,
  processed_at timestamptz default now()
);
alter table webhook_events enable row level security;

-- Free trial: ek user, ek hi baar, hamesha ke liye (server-only)
create table if not exists trial_claims (
  user_id uuid primary key references auth.users,
  claimed_at timestamptz default now()
);
alter table trial_claims enable row level security;

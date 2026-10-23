-- Phase 10: server push notifications (Web Push + FCM for the Android app)
-- Rows are written only by service-key API routes, isliye RLS on hai aur koi
-- public policy nahi hai (003 wala pattern).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  anon_id text,
  platform text not null check (platform in ('web', 'android')),
  endpoint text,
  p256dh text,
  auth text,
  fcm_token text,
  pref_expert boolean not null default true,
  pref_dua boolean not null default true,
  pref_daily boolean not null default true,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

-- Ek browser endpoint / ek device token par ek hi row.
create unique index if not exists push_sub_web_endpoint
  on push_subscriptions (endpoint) where platform = 'web';
create unique index if not exists push_sub_android_token
  on push_subscriptions (fcm_token) where platform = 'android';
create index if not exists push_sub_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Phase 3: users, plans, experts, bookings, feature flags
create table profiles (id uuid primary key references auth.users on delete cascade,
  display_name text, pref_lang text default 'en', created_at timestamptz default now());

create table plans (code text primary key, name text, price_inr int, interval text,   -- 'month' | 'once'
  daily_chat_limit int, active boolean default true);
insert into plans values ('free','Free',0,'month',30,true), ('premium','Premium',199,'month',null,true);

create table subscriptions (id bigserial primary key, user_id uuid references auth.users, plan_code text references plans,
  status text default 'active', provider text, provider_ref text, current_period_end timestamptz, created_at timestamptz default now());

create table experts (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users,
  name text, bio text, languages text[], madhab text, credential text,
  verified boolean default false, price_inr int, active boolean default false);

create table bookings (id uuid primary key default gen_random_uuid(),
  type text not null default 'expert_session',        -- expert_session | dua_request | ...
  user_id uuid references auth.users, expert_id uuid references experts,
  status text default 'pending',                       -- pending|paid|completed|cancelled|refunded
  scheduled_at timestamptz, amount_inr int, provider text, provider_ref text, notes text,
  created_at timestamptz default now());

create table feature_flags (key text primary key, enabled boolean default false);
insert into feature_flags values ('experts', false), ('payments', false), ('dua_requests', false), ('llm_answers', false);

alter table profiles enable row level security;  alter table subscriptions enable row level security;
alter table bookings enable row level security;  alter table experts enable row level security;
alter table plans enable row level security;     alter table feature_flags enable row level security;
create policy own_profile on profiles for all using (auth.uid() = id);
create policy own_subs on subscriptions for select using (auth.uid() = user_id);
create policy own_bookings on bookings for select using (auth.uid() = user_id);
create policy public_experts on experts for select using (verified and active);
create policy public_plans on plans for select using (active);
create policy public_flags on feature_flags for select using (true);
-- writes (booking, payment) server API se service key ke saath hote hain.

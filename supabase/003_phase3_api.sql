-- Anon key ab browser me hai, isliye saari tables par RLS ON (policy nahi = public access band; server service key se chalta hai)
alter table chunks enable row level security;   alter table display enable row level security;
alter table licenses enable row level security; alter table questions_log enable row level security;

alter table questions_log add column if not exists user_id uuid;
create index on questions_log (user_id, created_at);
create index on questions_log (anon_id, created_at);
alter table bookings add column if not exists meeting_url text;

create table payments (id bigserial primary key, user_id uuid references auth.users, kind text, ref text,
  razorpay_order_id text unique, razorpay_payment_id text, amount_inr int, status text default 'created',
  created_at timestamptz default now());
alter table payments enable row level security;
create policy own_payments on payments for select using (auth.uid() = user_id);

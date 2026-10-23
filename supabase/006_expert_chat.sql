-- Phase 5: async expert text Q&A (likh ke sawal, expert likh ke jawab)
create table if not exists expert_text_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  expert_id uuid references experts,
  question text not null,
  answer text,
  status text not null default 'open',   -- open | answered
  created_at timestamptz default now(),
  answered_at timestamptz
);
alter table expert_text_questions enable row level security;
create policy own_etq_select on expert_text_questions for select using (auth.uid() = user_id);
create index if not exists etq_user_idx on expert_text_questions (user_id, created_at desc);
create index if not exists etq_expert_idx on expert_text_questions (expert_id, status, created_at desc);
-- writes sirf service-key API routes se hote hain

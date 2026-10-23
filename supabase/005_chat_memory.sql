-- Phase 5: chat memory + embedding cache
-- questions_log me session + summary (conversation memory ke liye)
alter table questions_log add column if not exists session_id text;
alter table questions_log add column if not exists summary text;
create index if not exists questions_log_session_idx on questions_log (session_id, created_at desc);

-- embedding cache: HF Space hit karne se pehle yahan dekho
create table if not exists embedding_cache (
  normalized_text text primary key,
  embedding vector(1024),
  hits int not null default 1,
  created_at timestamptz default now()
);
alter table embedding_cache enable row level security;
-- koi policy nahi: sirf server (service key) se access

create extension if not exists vector;

create table chunks (            -- sirf ENGLISH text search ke liye (Quran + Hadith)
  id bigserial primary key,
  source text not null,          -- 'quran' | 'bukhari' | 'muslim'
  ref text not null,             -- '2:255' | 'bukhari:1'
  content text not null,
  meta jsonb default '{}',       -- grade, book, surah name etc
  embedding vector(1024),
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  unique (source, ref)
);
create index on chunks using hnsw (embedding vector_cosine_ops);
create index on chunks using gin (fts);

create table display (           -- sirf dikhane ke liye: arabic + hindi
  ref text not null, lang text not null, content text not null,
  primary key (ref, lang)
);

create table licenses (          -- har edition ka source + licence + attribution
  edition text primary key, source_url text, licence text, attribution text, verified boolean default false
);

create table questions_log (
  id bigserial primary key, created_at timestamptz default now(),
  anon_id text, lang text, topic text, question text,
  answered boolean, top_sim float, top_ref text
);

create or replace function match_hybrid(q vector(1024), qtext text, n int default 5)
returns table (ref text, source text, content text, meta jsonb, sim float, score float)
language sql stable as $$
  with sem as (
    select id, row_number() over (order by embedding <=> q) r
    from chunks order by embedding <=> q limit 30),
  kw as (
    select c.id, row_number() over (order by ts_rank(c.fts, tq) desc) r
    from chunks c, to_tsquery('english', qtext) tq
    where qtext <> '' and c.fts @@ tq
    order by ts_rank(c.fts, tq) desc limit 30)
  select c.ref, c.source, c.content, c.meta,
         1 - (c.embedding <=> q) as sim,
         coalesce(1.0/(60+sem.r),0) + coalesce(1.0/(60+kw.r),0) as score
  from sem full join kw on sem.id = kw.id
  join chunks c on c.id = coalesce(sem.id, kw.id)
  order by score desc limit n;
$$;

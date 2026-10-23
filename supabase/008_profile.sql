-- Phase 8: profile preferences (answer/translation language, region, prayer calculation)
-- profiles table 002 me bani thi; naye columns idempotent tareeqe se add hain.
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists answer_lang text default 'auto';
alter table profiles add column if not exists translation_lang text;
alter table profiles add column if not exists region text;
alter table profiles add column if not exists prayer_method int;
alter table profiles add column if not exists prayer_school int;

-- Har user sirf apni profile row dekh/badhal sakta hai (002 ki own_profile policy, idempotent).
drop policy if exists own_profile on profiles;
create policy own_profile on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

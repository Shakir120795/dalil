alter table experts add column if not exists dua_price_inr int;       -- null = dua service nahi deta
alter table bookings add column if not exists completed_at timestamptz;
-- flags 'dua_requests' aur 'llm_answers' 002 me pehle se hain (off)

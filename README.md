# Dalil (Phase 1: Quran + Hadith retrieval, no LLM)

Flow: question -> Hinglish synonym expansion -> embedding (HF Space) -> Supabase hybrid search (vector + keyword) -> cards (Arabic + English, Hindi toggle) -> questions_log.

## Setup (in this order)
1. **Supabase**: create a new project, and run `supabase/schema.sql` in the SQL editor.
2. **Ingest (on a laptop, one time)**
   ```bash
   cd ingest && python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   export SUPABASE_URL=... SUPABASE_SERVICE_KEY=...               # Windows: set
   python ingest_quran.py && python ingest_hadith.py
   ```
   Around 20k texts are embedded on CPU, which can take 30-60 minutes. The scripts are safe to re-run (upsert).
   `ingest_hadith.py` prints which editions it found; if no Hindi edition is available, it is skipped.
3. **Embed service (Hugging Face Space)**: create a new Space -> SDK **Docker** -> upload the files from `embed-service/`. Add the secret `EMBED_TOKEN` in Settings. A free Space sleeps when idle, so the first question will be slow.
4. **Web (Vercel)**: deploy the `web/` folder and set the env vars as in `web/.env.example`.
   Local test: `cd web && cp .env.example .env.local && npm i && npm run dev`
5. **Eval**: `node eval/run.mjs http://localhost:3000` (grow `questions.json` to your own 50 questions). Tune `MIN_SIM` from these results.

## Before launch — essentials
- Verify the licence of every edition yourself in the Supabase `licenses` table, set `verified=true`, and add the attribution page in the app.
- The service key must stay in server env only — never in client code.
- Write a privacy policy (question logs are stored against an anonymous anon_id).

## How to extend it
- New words: `web/lib/synonyms.ts`
- Adding an LLM: in `web/app/api/chat/route.ts`, only `compose()` changes.
- Play Store: `cd web && npm i @capacitor/core @capacitor/cli @capacitor/android && npx cap init`, then put the deployed Vercel URL in `server.url` (or use a static export).
- New features (experts, payments, azaan): a separate `modules/` folder plus new tables — the chat code stays untouched.
- For PWA install, add 192/512 icons in `web/public/manifest.json`.

## Phase 2 (added)
- **Azaan reminder:** turn the toggle on. In the Android app the notification arrives even when the phone is off; on the web it only works while the tab is open. Currently only today's remaining prayers are scheduled, and they are re-scheduled when the app opens. For the azaan sound, add your own mp3 under `android/app/src/main/res/raw/` and wire it into the notification channel (currently the default notification sound).
- **Qibla compass** (asks for sensor permission on iOS), **Ramadan mode** (Sehri/Iftar during Hijri month 9), **Urdu** (dropdown: English / + Hindi / + Urdu). For Urdu, re-run `ingest_quran.py` and `ingest_hadith.py`.
- **Android build:**
  ```bash
  cd web && npm i
  APP_URL=https://<your-app>.vercel.app npx cap add android
  npm run cap:sync && npm run cap:open     # In Android Studio: Build > Generate Signed Bundle
  ```
## Phase 3 (schema ready)
Run `supabase/002_phase3.sql`: profiles, plans, subscriptions, experts, bookings, feature_flags (all flags off). Auth UI, payments and the expert call are not in the code yet.

## Phase 3 (code added)
1. In the Supabase SQL editor run `002_phase3.sql`, then `003_phase3_api.sql` (003 enables RLS on all the old tables — required because the anon key is now in the browser).
2. In Supabase > Auth > URL Configuration, set Site URL to your Vercel URL.
3. Env vars (see `web/.env.example`): anon key, Razorpay key id/secret, Daily API key (for call rooms).
4. **Limits:** 10 questions/day without login, 30/day for free logged-in users, unlimited on premium (changeable in the plans table).
5. **Experts:** for now the admin adds rows to the `experts` table in Supabase manually: an expert shows only when `verified=true` and `active=true`. Verify the ijazah/certificate manually.
6. **Flags:** booking/payment only run when `experts` and `payments` are set to true in `feature_flags`.
7. **Payments:** Razorpay (India). Stripe (global) is not included yet. Expert payouts are manual (you handle the commission and transfer yourself; the records live in the `bookings` + `payments` tables). No Razorpay webhook was wired in this phase: if a user closes the tab after paying, the verification call could be missed — the webhook came later.

## Phase 4 (code added)
1. Run `supabase/004_phase4.sql` in Supabase.
2. **Admin dashboard:** `/admin`. Put your login email in the `ADMIN_EMAILS` env var. Topics, language, daily questions, the **unanswered list** (choose the next fiqh book from here), weak matches, and verified/active toggles for experts.
3. **Fiqh books:** `ingest/ingest_fiqh.py` (JSONL input; the format is in the docstring at the top of the file). Only add licence-clear text. Cards show "From a fiqh book — please confirm with a scholar".
4. **Optional LLM summary:** set `LLM_BASE_URL/LLM_MODEL/LLM_API_KEY` (Groq, Ollama, any OpenAI-compatible endpoint) and turn on `feature_flags.llm_answers`. The summary is built only from the sources given; every claim must cite a `[ref]`, otherwise the summary is dropped. The original source cards are always shown.
5. **Dua request:** turn on the `dua_requests` + `payments` flags and set `dua_price_inr` on the expert row. The user writes their intention (shown to the expert without their name), pays, the expert confirms "Dua done" in the `/expert` panel, and the user sees "Dua done" on `/dua`. The expert's `experts.user_id` must be linked to their login user.

## Phase 5 (UI overhaul + chatbot upgrades + retention)
Run `supabase/005_chat_memory.sql` and `supabase/006_expert_chat.sql` in Supabase (after 004).

**New UI:** bottom navigation (Chat, Namaz, Tasbih, Experts, More). The chat page now has message bubbles,
a typing indicator, voice input (mic button, Web Speech API), and follow-up chips after each answer.
Every source card has an Image/Share button — it creates a 1080x1080 PNG card (for WhatsApp status).
New pages: `/namaz` (full-day timetable, next-prayer countdown, Hijri date), `/tasbih` (dhikr counter,
progress ring, saved in localStorage), `/more` (menu).

**Chatbot:** each browser's `dalil_sid` session is stored in `questions_log.session_id`; the last 2 turns
go to the LLM summary as context. Follow-up questions ("iski", "aur", very short questions) are searched
together with the previous question. The LLM summary now streams over Server-Sent Events
(`POST /api/chat/stream`); if that fails, the old JSON `/api/chat` is the fallback.

**Retention:** "Ayah of the Day" on the home screen (`GET /api/ayah-of-day`, deterministic by day).

**Expert text Q&A:** on `/experts` the user picks an expert and sends a written question
(`POST /api/experts/ask`, `GET /api/experts/questions`); the expert answers in the `/expert` panel
(`POST /api/expert/answer`). A red dot appears on the Experts tab when there is a new answer. The `experts` flag is respected.

**Tech:** embedding cache (`embedding_cache` table, vector(1024)) — Supabase is checked before hitting the
HF Space. All feature_flags keep working as before; the payments flow is untouched.

## Phase 6 (premium subscriptions)
1. Run `supabase/007_subscriptions.sql` in the Supabase SQL editor (after 006). New plans:
   `premium_monthly` at ₹149/month, `premium_yearly` at ₹999/year (both unlimited), and `trial` (kept out of listings);
   the old one-time `premium` plan is made inactive.
2. Create two plans under **Razorpay Dashboard > Subscriptions > Plans** — ₹149 monthly and ₹999 yearly —
   and put their ids in env: `RAZORPAY_PLAN_ID_MONTHLY`, `RAZORPAY_PLAN_ID_YEARLY`.
   On subscribe, `POST /api/subscribe` creates a Razorpay subscription; checkout opens with the
   `subscription_id` (the UPI AutoPay mandate is created there). Verification happens in
   `/api/pay/verify` (signature = `payment_id|subscription_id`).
3. **Webhook:** in Razorpay Dashboard > Settings > Webhooks, set the URL to `https://getdalil.app/api/pay/webhook`,
   put the secret in the `RAZORPAY_WEBHOOK_SECRET` env var, and enable these events:
   `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted`,
   `subscription.pending`, `subscription.completed`, `payment.failed`. The webhook is the authoritative
   source for the lifecycle (even if the user closes the tab) — events are logged in `webhook_events`
   with idempotency, and `subscription.charged` also creates a `kind='subscription'` record in `payments`.
4. **States:** `trialing` (until trial_end), `active` (until period_end), `past_due` (payment failed —
   3 days of grace, then free), `cancelled` (cancel_at_period_end — access until the period ends, no renewal).
   Cancellation happens via `POST /api/subscribe/cancel` (at cycle end).
5. **Trial:** `POST /api/subscribe/trial` — 7 days, no card; thanks to `trial_claims`, each user gets it
   only once. The upgrade page shows the trial CTA only to users who haven't taken a trial.
6. **Gating:** the AI summary gives free users only a ~240-character preview (source cards are always
   free); share cards carry the `getdalil.app` watermark for free users and none for premium; expert text
   questions are 1/month on free and 10/month on premium (with an upgrade message on 402); premium gets a
   10% discount on expert video bookings. When the chat limit (429) is hit, an Upgrade button appears.
7. **Note:** the old one-time plan purchase path (`/api/pay/order` with kind='plan') is superseded by
   subscriptions, but has been left intact in the code; booking/dua payments continue to work as before.

## Phase 7 (AI chat experience + multilingual)
The chat is now a proper AI-assistant experience instead of a search-results page.

**AI answer first, sources as evidence:** the LLM answer (feature flag `llm_answers`) is the primary
content of every turn — streamed token-by-token over SSE (`POST /api/chat/stream`: `cards` -> `token`*
-> `answer_done` / `answer_locked` / `answer_rejected` -> `done`; the JSON `POST /api/chat` returns the
same answer fields). The retrieved Quran/Hadith/fiqh cards move into a compact **Sources** row under
the answer — tap a chip to expand the full card (Arabic, translation, share image). The prompt makes
Dalil answer conversationally from the sources only; a **citation guard** still drops any composed
answer that cites none of the provided `[ref]`s, in which case the UI shows the sources directly.
Premium gating is unchanged in effect: free/anonymous users receive a ~240-character preview stream and
then a lock event; premium/trial users get the full stream. The last two exchanges are passed as
conversation context, so follow-ups work in any language.

**Ask in any language:** users can type (or dictate) a question in English, Hindi, Hinglish, Urdu,
Arabic, Bengali, Turkish, Indonesian and more. The question language is detected cheaply
(`web/lib/lang.ts`: Unicode script ranges plus Latin-script markers). When the LLM is enabled and the
question is not English, it is first **translated to English for retrieval** — the corpus is English —
while the answer itself is generated from those English sources **in the user's own language and
script** (language mirroring in `web/lib/llm.ts`). If translation fails, retrieval falls back to the
raw question (bge-m3 embeddings are cross-lingual). A header selector, **Answer language**
(Auto / English / Hindi / Urdu / Arabic / Bengali / Turkish / Bahasa Indonesia), sets an explicit
reply language and also drives the voice-input locale; the empty state shows sample questions in
Urdu, Hindi and Arabic. The app UI itself remains 100% English. A **New chat** button clears the
thread and starts a fresh session.

## Phase 8 (user profiles + region-based auto language)
Run `supabase/008_profile.sql`. It adds preference columns to `profiles`
(`answer_lang`, `translation_lang`, `region`, `prayer_method`, `prayer_school`)
and re-creates the own-row RLS policy (a user can only read/update their own row).

**Profile page (`/profile`, linked from the chat header avatar and the More tab):**
shows the account (editable display name, email), the current plan with its status
and dates, an activity summary (questions asked, expert questions, bookings, dua
requests), an azaan-reminder toggle, and a preferences card — every change saves
immediately. Data comes from `GET /api/profile`; saves go through `PUT /api/profile`
(validated server-side). Logged-out visitors see a sign-in prompt, and the page
falls back to locally stored preferences if the API is unavailable.

**Region auto-detection (`web/lib/region.ts`):** on first use the app detects the
user's region from the browser timezone (`Intl.DateTimeFormat`) — India, Pakistan,
Bangladesh, Saudi Arabia, UAE, Qatar, Türkiye, Indonesia, North America, the UK,
with India as the default — and seeds the answer language, source-translation
language, Aladhan prayer calculation method and Asr school, and the voice-input
locale from it. If the browser language clearly maps to a supported language
(Urdu, Bengali, Arabic, Turkish, Hindi, Indonesian/Malay), it overrides the
answer language. In the chat header the **Answer language** selector's Auto option
now reads e.g. "Auto (detected: Urdu)": on Auto, the detected language is sent as
the reply language; the prayer API (`/api/prayer?method=&school=`) and the
timetable use the saved method/school. Users can override region, method and
languages any time in Profile — choices persist in `localStorage` (`dalil_prefs`)
and, when signed in, in their profile row.

## Phase 9 (region-wise answer languages)
The answer-language selection is region-aware but deliberately simple: every
region offers only its main language plus English, so any user can pick their
local language or English. India is the one exception — Hindi, Hinglish,
English and Urdu. The US and UK rows offer English only. Each region row's
short `languages` list lives in `web/lib/region.ts`; the full reply-language
catalog stays in `REPLY_LANGS` in `web/lib/lang.ts` (Auto mode still answers in
whatever language the user writes in — only the picker options are short).
Both selectors (Profile preferences and the chat page) show just the Auto
option plus the "Languages in {Region}" group; a saved language outside the
region's list still appears there, marked "current". Validation everywhere
(chat API, streaming API, `PUT /api/profile`) checks against the same catalog,
so there is one source of truth. Voice input uses the selected language's
locale from the catalog.

**Hinglish is its own option:** "Hinglish (Roman Hindi)" — Hindi written in the
Roman script, conversational style — is selectable alongside Hindi, and the
reply-language instruction in `web/lib/llm.ts` spells that out for the model.
Question-language detection (`detectLang`) now also recognises the Tamil,
Telugu, Malayalam, Kannada, Gujarati and Gurmukhi scripts, and Roman-script
questions with strong Hindi function words are detected as Hinglish rather
than Hindi (plain English questions are unaffected — detection needs two
distinct marker words). The app UI itself remains 100% English.

## Phase 10 (server push notifications)
Real server push, on top of the local azaan reminders: experts' replies, dua
completions, booking confirmations and a daily verse now reach users even when
the app is closed. Browsers use Web Push (VAPID, via a push-only service worker
at `web/public/sw.js`); the Android app uses FCM tokens from
`@capacitor/push-notifications`. Subscriptions live in `push_subscriptions`
(one row per browser endpoint or device token, with per-kind preferences —
expert / dua / daily). Sending lives in `web/lib/pushSend.ts` and is
fail-soft everywhere: a push failure never breaks chat, payments or expert
flows, and dead web subscriptions (404/410) are deleted automatically.

**Setup:**
1. Run `supabase/009_push.sql`.
2. Generate VAPID keys: `npx web-push generate-vapid-keys`. Set
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`.
3. Android: create a Firebase project, add the Android app
   (`google-services.json` into the Capacitor Android project) and set
   `FIREBASE_SERVICE_ACCOUNT` to the service-account JSON (one line) — the
   server exchanges it for an OAuth token and calls the FCM HTTP v1 API
   directly; no extra SDK is involved.
4. Daily verse (optional): schedule a daily call to `/api/push/daily` with
   header `Authorization: Bearer <CRON_SECRET>` (the endpoint accepts POST
   from external schedulers and GET from Vercel Cron — Vercel attaches that
   header itself when the `CRON_SECRET` env var is set). On Vercel, add to
   `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/push/daily", "schedule": "30 3 * * *" }] }
   ```

**Triggers:** expert answers a text question → the asker gets "Your question
was answered"; an expert marks a dua request done → "Your dua has been made";
a booking payment verifies → "Session booked"; the cron → "Verse of the Day"
to everyone who kept the daily preference on. Users manage all of it in
Profile → Notifications (enable/disable push, three per-kind toggles).

## Phase 11 (smart "Try asking" suggestions)
The home-page suggestion chips are no longer a fixed list. `GET /api/suggestions`
reads the last 90 days of answered `questions_log` rows and builds the chips
from real usage: the two most-asked topics always lead (each topic maps to one
polished canonical question), up to two genuinely frequent user questions can
follow — only if asked at least 3 times and passing a safety filter (length
10–90, no personal markers like "my"/"mera", no emails, phone-like digit runs
or links) — and the remaining slots rotate through the other top topics,
shuffled per request so repeat visits vary. When the log has fewer than 20
answered rows (or anything fails), the route returns the original static
examples, so a fresh install looks exactly as before. Responses carry
`Cache-Control: private, max-age=300` (5-minute cache) and the counting is
done in JS over a single capped read (5,000 rows), so the endpoint stays
cheap.

## Phase 12 (UI localization follows the selected answer language)
The selected answer language now drives the whole app experience, not just
the AI answer. All user-facing UI text — bottom navigation, the chat home
(hero, language bar, premium lock card, not-a-fatwa note, footer), Namaz,
Tasbih, More, Experts, Dua, Upgrade, Profile and Login — renders in the
chosen language, and the "Try asking" suggestion chips are localized too.
Auto means the region-detected main language; prayer calculation already
followed the region and still does.

- **8 UI languages:** English (default/fallback), Hindi (Devanagari),
  Hinglish (Roman Hindi), Urdu, Bengali, Turkish and Indonesian, plus
  Arabic. Strings live in `web/lib/i18n.ts` (`getStrings`/`useUiLang`),
  keyed per language with English fallback for any missing key. If the
  selected answer language is outside these 8 (e.g. Tamil), the AI answer
  still comes in that language but the UI chrome stays English.
- **Resolution order:** the chat selector's live choice wins, then the last
  saved chat choice (`dalil_reply_lang`), then the profile/prefs answer
  language, with Auto resolved from the detected region.
- **Suggestions:** `GET /api/suggestions?lang=<code>` localizes the canonical
  per-topic questions and labels (shared map in `web/lib/topicQuestions.ts`,
  all 11 topics) and the fallback chip set. Real frequent questions from the
  logs pass through unchanged — they are already in the users' own languages.
- **RTL:** Urdu and Arabic set `dir=rtl` on `<html>` (via `UiLangInit` +
  `useUiLang`), flipping the layout; chat bubbles stay on the inline-end and
  the gold card accent moves to the inline-start (see the `[dir="rtl"]` rules
  in `globals.css`). Prayer names keep their transliterations
  (Fajr/Dhuhr/Asr/Maghrib/Isha) with Arabic names alongside in the timetable;
  dhikr names stay Arabic + transliteration.
- **Stays English (by design):** the admin panel, expert-panel internals,
  the legal pages (privacy/terms/refund), API JSON messages and email text.

## Brand: Dalil (getdalil.app)
- Name, manifest, icons and the Capacitor `appId = app.getdalil` are all set. Domain env: `NEXT_PUBLIC_SITE_URL=https://getdalil.app`.
- **SEO:** title/description/Open Graph/Twitter, canonical, JSON-LD (WebApplication), `/about` (FAQ schema), automatic `sitemap.xml` and `robots.txt`, OG image. `/admin`, `/expert`, `/login` and `/api` are excluded from search.
- **Domain setup:** in Vercel > Project > Settings > Domains, add `getdalil.app` and add the DNS records Vercel shows at your registrar (HTTPS is automatic).
- **Supabase Auth:** add `https://getdalil.app` to the Site URL and Redirect URLs.
- **Search Console:** verify getdalil.app and submit `https://getdalil.app/sitemap.xml`.
- The chat page runs on JS, so the indexable content lives on `/about` and in the metadata. For more organic traffic, topic pages (such as "issues of wudu") can be added later.

## Legal pages
`/privacy`, `/terms` and `/refund` are built (text in `web/app/*/page.tsx`; name/email/city in `web/lib/legal.ts`). Before launch, fill in the `LEGAL` values, set up the support email, and have a lawyer read them once. Privacy Policy URL for the Play Store: `https://getdalil.app/privacy`.

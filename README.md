# Solo Leveling Council

A gamified self-improvement app. The user logs their day; a "Council" of three AI
personas (The Architect, The Tycoon, The Beast) audits it, and "The System"
synthesizes a verdict, stat changes, and 24-hour quests.

This repo contains the **production-corrected backend + database**. The React
Native frontend is generated separately in **Emergent AI** (prompt below).

> ✅ **Backend verified end-to-end (June 2026)** against live Gemini, OpenRouter, and
> Supabase: auth, signup trigger, JWT verification, REST CRUD, the atomic queue claim,
> both LLM calls, JSON validation, stat application, and cleanup — all confirmed working.

---

## Corrected stack (free APIs only)

| Component | Tool | Notes |
|---|---|---|
| Frontend | Emergent AI → React Native | Onboarding, stat dashboard, daily-log input |
| Backend | **Python + FastAPI** | API + in-process durable-queue worker. *(Antigravity is an IDE, not a runtime — it was removed from the stack.)* |
| Database | Supabase (Postgres) | Profiles, the queue, quests |
| Council | **Gemini 2.5 Flash** (free) | **One combined call** returns all three personas (3× quota saving) |
| Synthesizer | **openai/gpt-oss-120b** `:free` via OpenRouter | JSON-validated + retry. *(The free DeepSeek R1 endpoint was retired; gpt-oss-120b is the free replacement — faster and strong at structured output.)* |

### Free-tier limits you are operating inside (verified May 2026)
- **OpenRouter free tier** (`openai/gpt-oss-120b:free`) — 20 RPM, **50 requests/day**. This is the binding cap → **~50 user submissions/day total**. (A one-time $10 OpenRouter deposit raises it to 1,000/day — *intentionally skipped* per "free APIs only". Free model slugs change over time — if one 404s, run `GET https://openrouter.ai/api/v1/models` and swap `OPENROUTER_MODEL`.)
- **Gemini 2.5 Flash free** — ~10 RPM / ~250 RPD after Google's Dec 2025 cut (verify in AI Studio).
- **Supabase free** — pauses after **7 days of no DB activity**. See keep-alive note below.
- **Render free** — sleeps after 15 min; **~1–2 min cold start**. See keep-alive note.

---

## Build sequence

### 1. The Foundation — Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → paste & run [`db/schema.sql`](db/schema.sql). Creates the 3 tables, the
   atomic `claim_next_log()` queue claim, RLS policies, and the signup trigger.
3. Project Settings → API → copy the **URL**, **anon key**, and **service_role key**.

### 2. The Brains — backend
```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env     # then fill in your keys
uvicorn main:app --reload
```
Open http://127.0.0.1:8000/docs for the live API.

### 3. Test the pipeline end-to-end (one hardcoded user, no app yet)
Create a test user and grab a JWT via the Supabase Auth REST API:
```powershell
$BASE="https://YOUR_PROJECT_REF.supabase.co"; $ANON="your-anon-key"
# Sign up (or use /token?grant_type=password if the user exists)
$signup = irm "$BASE/auth/v1/signup" -Method Post -Headers @{apikey=$ANON} -ContentType application/json -Body '{"email":"test@example.com","password":"Passw0rd!"}'
$JWT = $signup.access_token
# Fill the profile, then submit a log:
irm "http://127.0.0.1:8000/api/me/profile" -Method Put -Headers @{Authorization="Bearer $JWT"} -ContentType application/json -Body '{"age":20,"occupation":"student","academic_goal":"Master ML","wealth_goal":"$10k/mo","physical_goal":"Lose 8kg","weight":82,"height":178}'
irm "http://127.0.0.1:8000/api/evaluate_day" -Method Post -Headers @{Authorization="Bearer $JWT"} -ContentType application/json -Body '{"log_data":"Studied 1h, skipped gym, ordered takeout, watched 3h YouTube."}'
# Wait a few seconds for the Council + Synthesizer, then fetch the verdict + quests:
irm "http://127.0.0.1:8000/api/me/quests" -Headers @{Authorization="Bearer $JWT"}
```

### 4. The Shell — generate the frontend in Emergent AI
Paste the prompt in [`EMERGENT_PROMPT`](#emergent-ai-frontend-prompt) below.

### 5. The Wiring
In the Emergent app, point the API base URL at your backend and attach the
Supabase session's `access_token` as `Authorization: Bearer <token>` on every call.

### 6. Launch
Deploy the backend (Render), export the Android `.aab` from Emergent.

---

## API contract
All routes except `GET /` require `Authorization: Bearer <supabase-jwt>`.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/` | Health check (use for keep-alive ping) |
| PUT  | `/api/me/profile` | Save onboarding fields |
| GET  | `/api/me/profile` | Profile + live stats |
| POST | `/api/evaluate_day` | Submit a daily log → `pending` (429 if over daily cap) |
| GET  | `/api/me/logs` | Recent logs + their status (`pending`→`processing`→`completed`/`failed`) |
| GET  | `/api/me/quests` | Latest verdict + quests + stat adjustments |

---

## Operational notes (don't skip — these were the blueprint's blind spots)
- **Secrets:** the `service_role` key lives only in the backend `.env` / host env. The
  mobile app uses **only** the anon key + the user's JWT.
- **`.env` can be shadowed by OS env vars:** pydantic-settings reads real environment
  variables *before* `.env`. If a key behaves as if it's wrong despite a correct `.env`,
  check for a stray variable, e.g. `[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')`.
- **Keep Supabase awake:** add a GitHub Action (cron every 5 days) that runs a trivial
  `select` so the project never auto-pauses.
- **Keep Render awake:** a free UptimeRobot monitor pinging `GET /` every ~10 min avoids
  cold starts (and keeps the in-process worker alive). Watch the 750 instance-hrs/month cap.
- **Failed logs:** rows with `status='failed'` (after 3 attempts) are your dead-letter
  queue — inspect `last_error`.
- **Scaling past ~50/day:** the only change needed is enabling paid Gemini/OpenRouter — no
  code change. The architecture already handles it.

---

## Emergent AI frontend prompt

> Build a React Native (Expo) mobile app called **"Solo Leveling Council"** — a dark,
> gamified self-improvement tracker with a Solo-Leveling RPG aesthetic (deep navy/black
> background, glowing blue accents, monospace stat numbers).
>
> **Auth:** Use Supabase Auth (email/password). Store the session and send the
> `access_token` as `Authorization: Bearer <token>` on every backend call.
>
> **Screens:**
> 1. **Awakening (Onboarding):** multi-step form collecting name, age, occupation,
>    intellectual goal, financial system, wealth goal, weight, height, physical goal.
>    On submit, `PUT {API}/api/me/profile`.
> 2. **Stats Dashboard:** three glowing stat bars — INTELLECT, WEALTH, STRENGTH —
>    read from `GET {API}/api/me/profile`. Show the latest System verdict and a list of
>    active quest cards (title, difficulty badge, XP reward, penalty) from
>    `GET {API}/api/me/quests`.
> 3. **Daily Log:** a large text input ("Report your day to the Council"). On submit,
>    `POST {API}/api/evaluate_day` with `{ "log_data": "..." }`. Then show an
>    "evaluating…" state and poll `GET {API}/api/me/quests` every 5–10s until new quests
>    appear (processing usually takes only a few seconds).
>
> Handle the `429` from `/api/evaluate_day` with a "The Council rests until tomorrow"
> message. Configure the backend base URL as an environment variable.

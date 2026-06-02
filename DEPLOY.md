# Deployment Guide — Solo Leveling Council backend

The backend deploys as a single **free Render web service** running uvicorn. The
in-process Council worker rides along inside it.

## 0. Prerequisites
- Push this repo to GitHub. `backend/.env` is gitignored — **secrets go in the Render
  dashboard / GitHub secrets, never the repo.**
- A [Render](https://render.com) account, plus your Supabase + Gemini + OpenRouter keys.

## 1. Deploy to Render (Blueprint)
1. Push this repo to GitHub.
2. Render → **New → Blueprint** → connect the repo. Render reads [`render.yaml`](render.yaml).
3. When prompted, paste the secret env vars (the ones marked `sync: false`):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `OPENROUTER_API_KEY`

   (Models, referer, and the daily cap are already baked into `render.yaml`.)
4. **Create** → wait for the build → you get a URL like
   `https://solo-leveling-council-api.onrender.com`.
5. Verify: open `<url>/` → `{"status":"ok"}`; open `<url>/docs` for the live API.

## 2. Keep Supabase awake (anti 7-day pause)
A free Supabase project pauses after 7 days with no DB queries.
[`.github/workflows/supabase-keepalive.yml`](.github/workflows/supabase-keepalive.yml)
runs a tiny query every ~4 days. To enable:
1. GitHub repo → **Settings → Secrets and variables → Actions** → add repo secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
2. **Actions** tab → enable workflows → open "Supabase keep-alive" → **Run workflow** once to test.

> GitHub disables scheduled workflows after 60 days of repo inactivity — push occasionally,
> or trigger it manually now and then.

## 3. Keep Render awake (anti 15-min sleep)
Free Render services sleep after 15 min idle (~1–2 min cold start). Add a free
[UptimeRobot](https://uptimerobot.com) HTTP(s) monitor on `<your-render-url>/` at a
5-minute interval. This also keeps the in-process worker alive.

> Mind the **750 instance-hours/month** free cap — one always-on service ≈ 730 hrs, so
> keep it to just this one service on the free plan.

## 4. Point the app at it
In [`frontend/config.js`](frontend/config.js), set `BACKEND_URL` to your Render URL
(e.g. `https://solo-leveling-council-api.onrender.com` — no trailing slash). Then reload
the app (or rebuild it for the stores with EAS). CORS can stay `*` to start — React Native
native requests don't send an `Origin` header anyway.

## Where each secret lives
| Secret | Lives in |
|---|---|
| All keys (local dev) | `backend/.env` (gitignored) |
| Backend keys (production) | Render dashboard env vars |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` (keep-alive) | GitHub repo secrets |
| `service_role` key | **Render only** — never in GitHub Actions or the app |

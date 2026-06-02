# Frontend — Solo Leveling Council (Expo / React Native)

Dark, gamified mobile client wired to your verified FastAPI backend.

## Screens
- **Auth** — Supabase email/password sign-in & sign-up.
- **The Awakening** — onboarding form → `PUT /api/me/profile`.
- **The System (Dashboard)** — stat bars + latest verdict + active quests (`GET /api/me/profile`, `GET /api/me/quests`).
- **Report to the Council** — daily log → `POST /api/evaluate_day`, then polls `GET /api/me/quests` until the verdict lands.

## 1. Install
```powershell
cd C:\Users\ravil\solo-leveling-council\frontend
npm install
npx expo install --fix    # aligns native deps to your installed Expo SDK
```

## 2. Point it at your backend
Edit **`config.js`** → set `BACKEND_URL`:

| Where you run the app | BACKEND_URL |
|---|---|
| Physical phone (Expo Go) | `http://<your-PC-LAN-IP>:8000` (e.g. `http://192.168.1.42:8000`) |
| Android emulator | `http://10.0.2.2:8000` |
| iOS simulator | `http://127.0.0.1:8000` |
| Deployed | `https://your-service.onrender.com` |

`SUPABASE_URL` and the **anon** key are already filled in (safe to ship — anon is public).

## 3. Run the backend so the phone can reach it
For a physical device, bind to all interfaces (not just localhost):
```powershell
cd ..\backend
Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```
(Your PC and phone must be on the same Wi-Fi. `CORS_ORIGINS=*` in `.env` already allows it — and React Native doesn't enforce CORS anyway.)

## 4. Start the app
```powershell
npx expo start
```
Scan the QR with **Expo Go** (Android/iOS), or press `a` / `i` for an emulator/simulator.

## 5. One Supabase setting for smooth testing
Supabase → **Authentication → Providers → Email** → turn **"Confirm email" OFF** while testing, so sign-up logs you straight in. (Leave it on for production and the app will tell users to confirm.)

## 6. Build the Play Store `.aab`
```powershell
npm install -g eas-cli
eas login
eas build -p android --profile production
```
EAS returns a downloadable `.aab` to upload to the Play Console. (Free Expo account required; the build runs in Expo's cloud.)

## Troubleshooting
- **Network request failed** → wrong `BACKEND_URL` (use LAN IP, not `localhost`, on a real phone) or the backend isn't bound to `0.0.0.0`.
- **Version warnings on start** → `npx expo install --fix`, then `npx expo-doctor`.
- **401 on every call** → you're not signed in, or the Supabase session expired — sign out and back in.

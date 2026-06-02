// ── App configuration ───────────────────────────────────────────────────────
// SUPABASE_URL + anon key are SAFE to ship in a client (the anon key is public
// by design; Row-Level Security protects the data). The service_role key must
// NEVER appear here.

export const SUPABASE_URL = "https://kcmxkogdpvyztoiejpgu.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbXhrb2dkcHZ5enRvaWVqcGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTk2NTIsImV4cCI6MjA5NTg3NTY1Mn0.Dn-6Pt68mP36cKFL0oVqKzlAZ3YTlvCY78PhilKlf_Q";

// ── Your FastAPI backend ─────────────────────────────────────────────────────
// CHANGE THIS. See SETUP.md for the right value:
//   • Physical phone (Expo Go):  http://<your-PC-LAN-IP>:8000   (e.g. http://192.168.1.42:8000)
//                                and run uvicorn with  --host 0.0.0.0
//   • Android emulator:          http://10.0.2.2:8000
//   • iOS simulator:             http://127.0.0.1:8000
//   • Deployed (Render):         https://your-service.onrender.com
export const BACKEND_URL = "http://192.168.1.34:8000";

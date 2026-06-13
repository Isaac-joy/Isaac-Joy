import { BACKEND_URL } from "../config";
import { supabase } from "./supabase";

// Attaches the current Supabase access token as a Bearer header on every call.
async function authedFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  let res;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (netErr) {
    const e = new Error(
      "Can't reach the System. Make sure the backend is running and BACKEND_URL in config.js points to your PC's IP."
    );
    e.status = 0;
    throw e;
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.detail) detail = body.detail;
    } catch (_) {
      // non-JSON error body — keep the status code message
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  getProfile: () => authedFetch("/api/me/profile"),
  updateProfile: (body) =>
    authedFetch("/api/me/profile", { method: "PUT", body: JSON.stringify(body) }),
  submitLog: (logData) =>
    authedFetch("/api/evaluate_day", {
      method: "POST",
      body: JSON.stringify({ log_data: logData }),
    }),
  getQuests: () => authedFetch("/api/me/quests"),
  getLogs: () => authedFetch("/api/me/logs"),

  // ── Missions ──────────────────────────────────────────────────────────────
  getMissions: () => authedFetch("/api/me/missions"),
  generateMissions: () =>
    authedFetch("/api/me/missions/generate", { method: "POST" }),
  addMission: (body) =>
    authedFetch("/api/me/missions", { method: "POST", body: JSON.stringify(body) }),
  editMission: (id, body) =>
    authedFetch(`/api/me/missions/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  polishMission: (body) =>
    authedFetch("/api/me/missions/polish", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  completeMission: (id) =>
    authedFetch(`/api/me/missions/${id}/complete`, { method: "POST" }),
  deleteMission: (id) =>
    authedFetch(`/api/me/missions/${id}`, { method: "DELETE" }),

  // ── Workouts ────────────────────────────────────────────────────────────────
  getWorkout: () => authedFetch("/api/me/workout"),
  generateWorkout: () =>
    authedFetch("/api/me/workout/generate", { method: "POST" }),
  regenerateWorkout: () =>
    authedFetch("/api/me/workout/regenerate", { method: "POST" }),
  completeWorkout: (id) =>
    authedFetch(`/api/me/workout/${id}/complete`, { method: "POST" }),

  // ── Resources ───────────────────────────────────────────────────────────────
  getResources: () => authedFetch("/api/me/resources"),
  generateResources: () =>
    authedFetch("/api/me/resources/generate", { method: "POST" }),
  refreshResources: () =>
    authedFetch("/api/me/resources/refresh", { method: "POST" }),

  // ── Academy ─────────────────────────────────────────────────────────────────
  getBooks: () => authedFetch("/api/me/books"),
  enrollBook: (body) =>
    authedFetch("/api/me/books", { method: "POST", body: JSON.stringify(body) }),
  getChapters: (bookId) => authedFetch(`/api/me/books/${bookId}/chapters`),
  completeChapter: (bookId, chapterId) =>
    authedFetch(`/api/me/books/${bookId}/chapters/${chapterId}/complete`, {
      method: "POST",
    }),
  getChapterNotes: (bookId, chapterId) =>
    authedFetch(`/api/me/books/${bookId}/chapters/${chapterId}/notes`, {
      method: "POST",
    }),
  deleteBook: (bookId) =>
    authedFetch(`/api/me/books/${bookId}`, { method: "DELETE" }),
};

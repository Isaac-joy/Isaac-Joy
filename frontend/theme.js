import { Platform } from "react-native";

// ── Core palette (deep-space navy + neon blue/cyan) ──────────────────────────
export const colors = {
  bg: "#070A14",
  bgAlt: "#0A0E1A",
  surface: "#121829",
  surfaceAlt: "#1A2238",
  glass: "rgba(18,24,41,0.72)",
  glassDeep: "rgba(10,14,26,0.85)",
  border: "#243049",
  borderGlow: "rgba(96,165,250,0.22)",
  accent: "#3B82F6", // intellect / primary
  accentGlow: "#60A5FA",
  gold: "#FBBF24", // wealth
  cyan: "#22D3EE", // strength
  violet: "#A78BFA", // general
  text: "#E5ECFF",
  textDim: "#8A97B8",
  textFaint: "#5B698A",
  danger: "#EF4444",
  success: "#34D399",
};

// ── Gradients (for backgrounds, buttons, bars, chips) ────────────────────────
export const gradients = {
  bg: ["#070A14", "#0C1226", "#070A14"],
  accent: ["#3B82F6", "#22D3EE"],
  gold: ["#F59E0B", "#FBBF24"],
  cyan: ["#06B6D4", "#22D3EE"],
  violet: ["#7C3AED", "#A78BFA"],
  danger: ["#EF4444", "#7F1D1D"],
  success: ["#10B981", "#34D399"],
};

// ── Per-category styling (missions + quests) ─────────────────────────────────
export const category = {
  intellect: { color: colors.accent, grad: gradients.accent, label: "INTELLECT" },
  wealth: { color: colors.gold, grad: gradients.gold, label: "WEALTH" },
  strength: { color: colors.cyan, grad: gradients.cyan, label: "STRENGTH" },
  general: { color: colors.violet, grad: gradients.violet, label: "GENERAL" },
};

export function catOf(key) {
  return category[String(key || "general").toLowerCase()] || category.general;
}

export const fonts = {
  mono: Platform.OS === "ios" ? "Menlo" : "monospace",
};

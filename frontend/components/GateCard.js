import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, gradients } from "../theme";
import { RANK_COLOR } from "./HunterStatus";
import NeonButton from "./NeonButton";

function timeLeft(deadline) {
  if (!deadline) return "";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "expiring";
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hrs}h left` : `${hrs}h left`;
}

export default function GateCard({ gate, onOpen, onToggle, onRegenerate, busy }) {
  const g = gate || {};
  const status = g.status;

  // No Gate opened yet
  if (!g.id || !status) {
    return (
      <View style={[styles.card, styles.dashed]}>
        <Ionicons name="planet-outline" size={30} color={colors.violet} />
        <Text style={styles.emptyTitle}>A GATE STIRS</Text>
        <Text style={styles.emptyText}>
          The System can open a 7-day dungeon that hammers your weakest stat.
        </Text>
        <NeonButton
          title={busy ? "OPENING" : "⟔ OPEN A GATE"}
          onPress={onOpen}
          busy={busy}
          grad={gradients.violet}
          glow={colors.violet}
          style={{ marginTop: 12, alignSelf: "stretch" }}
        />
      </View>
    );
  }

  if (status === "cleared") {
    return (
      <View style={[styles.card, { borderColor: colors.success, shadowColor: colors.success }]}>
        <Text style={[styles.banner, { color: colors.success }]}>⟔ GATE CLEARED ✓</Text>
        <Text style={styles.title}>{g.title}</Text>
        <Text style={styles.subSuccess}>+{g.reward_xp} XP claimed. The void yields.</Text>
        <NeonButton
          title={busy ? "OPENING" : "OPEN NEXT GATE"}
          onPress={onOpen}
          busy={busy}
          grad={gradients.violet}
          glow={colors.violet}
          style={{ marginTop: 12, alignSelf: "stretch" }}
        />
      </View>
    );
  }

  if (status === "collapsed") {
    return (
      <View style={[styles.card, { borderColor: colors.danger, shadowColor: colors.danger }]}>
        <Text style={[styles.banner, { color: colors.danger }]}>⟔ GATE COLLAPSED</Text>
        <Text style={styles.title}>{g.title}</Text>
        <Text style={styles.subDanger}>
          The trial expired before you cleared it. The System is unimpressed.
        </Text>
        <NeonButton
          title={busy ? "OPENING" : "OPEN A NEW GATE"}
          onPress={onOpen}
          busy={busy}
          grad={gradients.violet}
          glow={colors.violet}
          style={{ marginTop: 12, alignSelf: "stretch" }}
        />
      </View>
    );
  }

  // active
  const objs = Array.isArray(g.objectives) ? g.objectives : [];
  const done = objs.filter((o) => o.done).length;
  const rankColor = RANK_COLOR[g.rank] || colors.violet;

  return (
    <View style={[styles.card, { borderColor: "rgba(167,139,250,0.5)", shadowColor: colors.violet }]}>
      <View style={styles.head}>
        <View style={[styles.rankBadge, { borderColor: rankColor }]}>
          <Text style={[styles.rankTxt, { color: rankColor }]}>{g.rank}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.kicker}>⟔ GATE OPEN · {timeLeft(g.deadline)}</Text>
          <Text style={styles.title}>{g.title}</Text>
        </View>
      </View>

      {g.description ? <Text style={styles.desc}>{g.description}</Text> : null}

      {objs.map((o, i) => (
        <Pressable key={i} style={styles.objRow} onPress={() => onToggle(i)} disabled={busy}>
          <Ionicons
            name={o.done ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={o.done ? colors.success : colors.violet}
          />
          <Text style={[styles.objTxt, o.done && styles.objDone]}>{o.text}</Text>
        </Pressable>
      ))}

      <View style={styles.footer}>
        <Text style={styles.progress}>{done}/{objs.length} CLEARED</Text>
        <Text style={styles.reward}>+{g.reward_xp} XP</Text>
        <Pressable onPress={onRegenerate} hitSlop={8} disabled={busy}>
          <Ionicons name="refresh" size={16} color={colors.textDim} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: 16,
    marginBottom: 22,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  dashed: { alignItems: "center", borderStyle: "dashed", borderColor: "rgba(167,139,250,0.5)" },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: "900", letterSpacing: 2, marginTop: 10 },
  emptyText: { color: colors.textDim, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 6 },

  banner: { fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  subSuccess: { color: colors.text, fontSize: 13, marginTop: 6 },
  subDanger: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6 },

  head: { flexDirection: "row", alignItems: "center" },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,10,20,0.5)",
  },
  rankTxt: { fontSize: 18, fontWeight: "900", fontFamily: fonts.mono },
  kicker: { color: colors.violet, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 16, fontWeight: "900", letterSpacing: 0.5, marginTop: 1 },
  desc: { color: colors.textDim, fontSize: 13, lineHeight: 19, fontStyle: "italic", marginTop: 10 },

  objRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 12 },
  objTxt: { color: colors.text, fontSize: 14, lineHeight: 20, marginLeft: 10, flex: 1 },
  objDone: { textDecorationLine: "line-through", color: colors.textDim },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progress: { color: colors.violet, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  reward: {
    color: colors.accentGlow,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: fonts.mono,
  },
});

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { catOf, colors, fonts } from "../theme";

const DIFF_COLOR = {
  easy: colors.success,
  medium: colors.gold,
  hard: colors.danger,
  legendary: colors.accentGlow,
};

export default function QuestCard({ quest }) {
  const diff = String(quest.difficulty || "").toLowerCase();
  const diffColor = DIFF_COLOR[diff] || colors.textDim;
  const cat = catOf(quest.category);

  return (
    <View style={[styles.card, { shadowColor: cat.color }]}>
      <LinearGradient
        colors={cat.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.edge}
      />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title}>{quest.title}</Text>
          {quest.difficulty ? (
            <Text style={[styles.badge, { color: diffColor, borderColor: diffColor }]}>
              {String(quest.difficulty).toUpperCase()}
            </Text>
          ) : null}
        </View>

        {quest.category ? (
          <Text style={[styles.category, { color: cat.color }]}>
            {String(quest.category).toUpperCase()}
          </Text>
        ) : null}

        {quest.description ? <Text style={styles.desc}>{quest.description}</Text> : null}

        <View style={styles.footer}>
          <Text style={styles.xp}>+{quest.xp_reward ?? 0} XP</Text>
          {quest.penalty_for_failure ? (
            <Text style={styles.penalty}>⚠ {quest.penalty_for_failure}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  edge: { width: 4 },
  body: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.text, fontSize: 16, fontWeight: "800", flex: 1, paddingRight: 8 },
  badge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  category: { fontSize: 11, letterSpacing: 1.5, marginTop: 4, fontWeight: "700" },
  desc: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 8 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  xp: {
    color: colors.accentGlow,
    fontFamily: fonts.mono,
    fontWeight: "700",
    fontSize: 14,
    textShadowColor: colors.accent,
    textShadowRadius: 8,
  },
  penalty: {
    color: colors.danger,
    fontSize: 11,
    fontStyle: "italic",
    flexShrink: 1,
    textAlign: "right",
    paddingLeft: 8,
  },
});

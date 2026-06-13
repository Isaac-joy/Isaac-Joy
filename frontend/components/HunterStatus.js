import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fonts } from "../theme";

export const RANK_ORDER = ["E", "D", "C", "B", "A", "S", "SS"];
export const RANK_COLOR = {
  E: "#8A97B8",
  D: "#34D399",
  C: "#22D3EE",
  B: "#3B82F6",
  A: "#A78BFA",
  S: "#FBBF24",
  SS: "#F472B6",
};

// The Hunter's progression spine: rank emblem + level + XP-to-next-rank bar.
export default function HunterStatus({ profile }) {
  const rank = profile.rank || "E";
  const color = RANK_COLOR[rank] || colors.accent;
  const level = profile.level || 1;
  const progress = typeof profile.rank_progress === "number" ? profile.rank_progress : 0;
  const nextRank = profile.next_rank;
  const toNext = profile.xp_to_next_rank || 0;

  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, {
      toValue: Math.max(0, Math.min(1, progress)) * 100,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress, w]);
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <View style={[styles.card, { borderColor: color, shadowColor: color }]}>
      <View style={[styles.emblem, { borderColor: color, shadowColor: color }]}>
        <Text style={[styles.rankLetter, { color, textShadowColor: color }]}>{rank}</Text>
        <Text style={styles.rankWord}>RANK</Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.level}>
          LEVEL <Text style={[styles.levelNum, { color }]}>{level}</Text>
        </Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width }]}>
            <LinearGradient
              colors={[color, colors.accentGlow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fillInner}
            />
          </Animated.View>
        </View>
        <Text style={styles.toNext}>
          {nextRank ? `${toNext.toLocaleString()} XP → ${nextRank}-RANK` : "MAX RANK ACHIEVED"}
        </Text>
        <Text style={styles.totalXp}>{(profile.total_xp || 0).toLocaleString()} XP TOTAL</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 22,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  emblem: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,10,20,0.6)",
    marginRight: 16,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  rankLetter: {
    fontSize: 34,
    fontWeight: "900",
    fontFamily: fonts.mono,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  rankWord: { color: colors.textDim, fontSize: 8, letterSpacing: 3, fontWeight: "800", marginTop: -2 },
  right: { flex: 1 },
  level: { color: colors.textDim, fontSize: 13, letterSpacing: 2, fontWeight: "800" },
  levelNum: { fontSize: 18, fontWeight: "900", fontFamily: fonts.mono },
  track: {
    height: 10,
    backgroundColor: "rgba(36,48,73,0.6)",
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 8,
  },
  fill: { height: "100%", borderRadius: 5, overflow: "hidden" },
  fillInner: { flex: 1 },
  toNext: { color: colors.text, fontSize: 12, fontWeight: "700", marginTop: 7, fontFamily: fonts.mono },
  totalXp: { color: colors.textDim, fontSize: 10, letterSpacing: 1, marginTop: 2 },
});

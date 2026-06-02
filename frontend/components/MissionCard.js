import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { catOf, colors, fonts } from "../theme";

export default function MissionCard({ mission, onToggle, onEdit, onDelete, busy }) {
  const cat = catOf(mission.category);
  const done = mission.status === "completed";
  const isSystem = mission.source === "system";

  // Subtle "check" pop when completion state changes.
  const checkScale = useRef(new Animated.Value(done ? 1 : 0.6)).current;
  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: done ? 1 : 0.6,
      useNativeDriver: true,
      speed: 30,
      bounciness: 12,
    }).start();
  }, [done, checkScale]);

  return (
    <View style={[styles.card, { shadowColor: cat.color }, done && styles.cardDone]}>
      <LinearGradient
        colors={done ? [colors.border, colors.border] : cat.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.edge}
      />

      {/* Complete toggle */}
      <Pressable onPress={onToggle} disabled={busy} hitSlop={8} style={styles.checkWrap}>
        <Animated.View style={{ transform: [{ scale: checkScale }] }}>
          {done ? (
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          ) : (
            <Ionicons name="ellipse-outline" size={28} color={cat.color} />
          )}
        </Animated.View>
      </Pressable>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]}>{mission.title}</Text>

        {mission.description ? (
          <Text style={[styles.desc, done && styles.descDone]} numberOfLines={3}>
            {mission.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={[styles.chip, { borderColor: cat.color }]}>
            <Text style={[styles.chipTxt, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <View style={[styles.chip, styles.srcChip]}>
            <Text style={styles.srcTxt}>{isSystem ? "SYSTEM" : "YOU"}</Text>
          </View>
          <Text style={styles.xp}>+{mission.xp_reward ?? 0} XP</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable onPress={onEdit} disabled={busy} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name="create-outline" size={19} color={colors.textDim} />
        </Pressable>
        <Pressable onPress={onDelete} disabled={busy} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.textDim} />
        </Pressable>
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
    alignItems: "flex-start",
    overflow: "hidden",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardDone: { opacity: 0.6 },
  edge: { width: 4, alignSelf: "stretch" },
  checkWrap: { paddingLeft: 12, paddingRight: 6, paddingTop: 14 },
  body: { flex: 1, paddingVertical: 14, paddingRight: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: "800", lineHeight: 21 },
  titleDone: { textDecorationLine: "line-through", color: colors.textDim },
  desc: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 4 },
  descDone: { textDecorationLine: "line-through" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 10, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  chipTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  srcChip: { borderColor: colors.border },
  srcTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: colors.textDim },
  xp: {
    color: colors.accentGlow,
    fontFamily: fonts.mono,
    fontWeight: "700",
    fontSize: 12,
    marginLeft: "auto",
  },
  actions: { paddingRight: 10, paddingTop: 12, alignItems: "center" },
  actionBtn: { padding: 6 },
});

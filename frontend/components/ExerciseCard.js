import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts } from "../theme";

export default function ExerciseCard({ exercise, index }) {
  const e = exercise || {};
  const sets = e.sets ? `${e.sets} ${e.sets === 1 ? "set" : "sets"}` : "";
  const rep = e.reps ? `${e.reps} reps` : e.duration || "";
  const metric = [sets, rep].filter(Boolean).join("  ·  ");

  return (
    <View style={styles.card}>
      <View style={styles.numWrap}>
        <Text style={styles.num}>{String(index + 1).padStart(2, "0")}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text style={styles.name}>{e.name}</Text>
          {e.target ? (
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>{String(e.target).toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        {metric ? <Text style={styles.metric}>{metric}</Text> : null}

        <View style={styles.tagRow}>
          {e.equipment ? (
            <View style={styles.tag}>
              <Ionicons name="barbell-outline" size={12} color={colors.textDim} />
              <Text style={styles.tagTxt}>{e.equipment}</Text>
            </View>
          ) : null}
        </View>

        {e.notes ? <Text style={styles.notes}>“{e.notes}”</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
  },
  numWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "rgba(34,211,238,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  num: { color: colors.cyan, fontFamily: fonts.mono, fontWeight: "800", fontSize: 13 },
  body: { flex: 1 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipTxt: { color: colors.cyan, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  metric: {
    color: colors.accentGlow,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  tag: { flexDirection: "row", alignItems: "center" },
  tagTxt: { color: colors.textDim, fontSize: 12, marginLeft: 4 },
  notes: { color: colors.textDim, fontSize: 12, fontStyle: "italic", marginTop: 6, lineHeight: 17 },
});

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { colors, gradients } from "../theme";

const DEMAND = {
  high: { color: colors.success, label: "HIGH DEMAND" },
  growing: { color: colors.accentGlow, label: "GROWING" },
  stable: { color: colors.gold, label: "STABLE" },
  niche: { color: colors.violet, label: "NICHE" },
};

export default function CareerCard({ path, rank }) {
  const p = path || {};
  const d = DEMAND[String(p.demand || "growing").toLowerCase()] || DEMAND.growing;
  const skills = Array.isArray(p.key_skills) ? p.key_skills : [];

  return (
    <View style={[styles.card, { shadowColor: d.color }]}>
      <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.edge} />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text style={styles.rank}>{String(rank).padStart(2, "0")}</Text>
          <Text style={styles.field}>{p.field}</Text>
          <View style={[styles.demand, { borderColor: d.color }]}>
            <Text style={[styles.demandTxt, { color: d.color }]}>{d.label}</Text>
          </View>
        </View>

        {p.fit_reason ? (
          <View style={styles.row}>
            <Ionicons name="person-outline" size={13} color={colors.accentGlow} />
            <Text style={styles.rowTxt}>{p.fit_reason}</Text>
          </View>
        ) : null}

        {p.growth_outlook ? (
          <View style={styles.row}>
            <Ionicons name="trending-up-outline" size={13} color={colors.success} />
            <Text style={styles.rowTxt}>{p.growth_outlook}</Text>
          </View>
        ) : null}

        {skills.length > 0 ? (
          <View style={styles.skillRow}>
            {skills.map((s, i) => (
              <View key={i} style={styles.skill}>
                <Text style={styles.skillTxt}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {p.first_step ? (
          <View style={styles.firstStep}>
            <Ionicons name="rocket-outline" size={13} color={colors.gold} />
            <Text style={styles.firstStepTxt}>
              <Text style={{ fontWeight: "900" }}>This week: </Text>
              {p.first_step}
            </Text>
          </View>
        ) : null}
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
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  edge: { width: 4 },
  body: { flex: 1, padding: 14 },
  headRow: { flexDirection: "row", alignItems: "center" },
  rank: { color: colors.textDim, fontSize: 12, fontWeight: "900", marginRight: 8 },
  field: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1, paddingRight: 6 },
  demand: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  demandTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "flex-start", marginTop: 8 },
  rowTxt: { color: colors.textDim, fontSize: 12.5, lineHeight: 18, marginLeft: 7, flex: 1 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  skill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  skillTxt: { color: colors.text, fontSize: 10, fontWeight: "700" },
  firstStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderRadius: 8,
    padding: 9,
  },
  firstStepTxt: { color: colors.text, fontSize: 12.5, lineHeight: 18, marginLeft: 7, flex: 1 },
});

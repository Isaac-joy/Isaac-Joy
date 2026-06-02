import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { catOf, colors } from "../theme";

const TYPE_ICON = {
  book: "book-outline",
  course: "school-outline",
  tool: "construct-outline",
  channel: "logo-youtube",
  article: "document-text-outline",
};

export default function ResourceCard({ resource }) {
  const r = resource || {};
  const cat = catOf(r.category);
  const icon = TYPE_ICON[String(r.type || "book").toLowerCase()] || "sparkles-outline";

  return (
    <View style={[styles.card, { shadowColor: cat.color }]}>
      <LinearGradient
        colors={cat.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.edge}
      />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Ionicons name={icon} size={18} color={cat.color} style={{ marginRight: 8 }} />
          <Text style={styles.title}>{r.title}</Text>
        </View>

        {r.author ? <Text style={styles.author}>by {r.author}</Text> : null}

        <View style={styles.metaRow}>
          <View style={[styles.chip, { borderColor: cat.color }]}>
            <Text style={[styles.chipTxt, { color: cat.color }]}>
              {String(r.type || "").toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.cat, { color: cat.color }]}>{cat.label}</Text>
        </View>

        {r.reason ? <Text style={styles.reason}>⟡ {r.reason}</Text> : null}
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
  body: { flex: 1, padding: 16 },
  headRow: { flexDirection: "row", alignItems: "center" },
  title: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 },
  author: { color: colors.textDim, fontSize: 12, marginTop: 3, marginLeft: 26 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 10, marginLeft: 26 },
  chip: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  chipTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  cat: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  reason: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    marginLeft: 26,
    fontStyle: "italic",
  },
});

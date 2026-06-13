import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme";

const PERSONA_COLOR = {
  "The Architect": colors.accent,
  "The Tycoon": colors.gold,
  "The Beast": colors.danger,
};

// Collapsible view of the Council's individual audits + their in-character clash.
export default function CouncilDebate({ council }) {
  const [open, setOpen] = useState(false);
  const audits = (council && council.audits) || [];
  const debate = (council && council.debate) || [];
  if (audits.length === 0 && debate.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.header} onPress={() => setOpen(!open)}>
        <Ionicons name="people" size={15} color={colors.accentGlow} />
        <Text style={styles.headerTxt}>THE COUNCIL'S DEBATE</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textDim} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {audits.map((a, i) => (
            <View key={`a${i}`} style={styles.audit}>
              <Text style={[styles.persona, { color: PERSONA_COLOR[a.persona] || colors.text }]}>
                {a.persona}
              </Text>
              {a.brutal_truth ? <Text style={styles.truth}>“{a.brutal_truth}”</Text> : null}
              {a.action ? <Text style={styles.action}>→ {a.action}</Text> : null}
            </View>
          ))}

          {debate.length ? <Text style={styles.clashLabel}>⚔ THE CLASH</Text> : null}
          {debate.map((d, i) => (
            <Text key={`d${i}`} style={styles.debateLine}>
              <Text style={[styles.debatePersona, { color: PERSONA_COLOR[d.persona] || colors.text }]}>
                {d.persona}:{" "}
              </Text>
              {d.line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    marginBottom: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  headerTxt: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
  audit: { marginBottom: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  persona: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  truth: { color: colors.text, fontSize: 13, lineHeight: 19, fontStyle: "italic", marginTop: 4 },
  action: { color: colors.textDim, fontSize: 12, lineHeight: 17, marginTop: 4 },
  clashLabel: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 6,
    marginBottom: 8,
  },
  debateLine: { color: colors.text, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  debatePersona: { fontWeight: "900" },
});

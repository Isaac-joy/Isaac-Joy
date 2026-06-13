import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../lib/api";
import { colors } from "../theme";
import GradientBackground from "../components/GradientBackground";
import NeonButton from "../components/NeonButton";
import FadeIn from "../components/FadeIn";

const FIELDS = [
  { key: "name", label: "Name", keyboard: "default" },
  { key: "age", label: "Age", keyboard: "numeric" },
  { key: "occupation", label: "Occupation", keyboard: "default" },
  { key: "education_level", label: "Education level / class", keyboard: "default" },
  { key: "interests", label: "Your interests (the System tailors everything to these)", multiline: true },
  { key: "academic_goal", label: "Intellectual goal", multiline: true },
  { key: "financial_system", label: "Financial system", multiline: true },
  { key: "wealth_goal", label: "Wealth goal", multiline: true },
  { key: "weight", label: "Weight (kg)", keyboard: "numeric" },
  { key: "height", label: "Height (cm)", keyboard: "numeric" },
  { key: "physical_goal", label: "Physical goal", multiline: true },
  { key: "equipment", label: "Available equipment", multiline: true },
];

export default function OnboardingScreen({ navigation }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {};
      for (const f of FIELDS) {
        const raw = form[f.key];
        if (raw === undefined || raw === "") continue;
        if (f.key === "age") payload.age = parseInt(raw, 10);
        else if (f.key === "weight" || f.key === "height") payload[f.key] = parseFloat(raw);
        else payload[f.key] = raw;
      }
      await api.updateProfile(payload);
      navigation.replace("Main");
    } catch (e) {
      Alert.alert("Could not save profile", e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FadeIn>
          <Text style={styles.intro}>
            Define your Hunter profile. The Council calibrates every verdict — and every
            mission — to these.
          </Text>
        </FadeIn>

        {FIELDS.map((f, i) => (
          <FadeIn key={f.key} delay={40 + i * 25}>
            <View style={styles.field}>
              <Text style={styles.label}>{f.label.toUpperCase()}</Text>
              <TextInput
                style={[styles.input, f.multiline && styles.multiline]}
                placeholder={f.label}
                placeholderTextColor={colors.textDim}
                keyboardType={f.keyboard || "default"}
                multiline={!!f.multiline}
                value={form[f.key] ?? ""}
                onChangeText={(v) => set(f.key, v)}
                textAlignVertical={f.multiline ? "top" : "center"}
              />
            </View>
          </FadeIn>
        ))}

        <NeonButton
          title={busy ? "SAVING" : "BEGIN"}
          onPress={save}
          busy={busy}
          style={{ marginTop: 10 }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  intro: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  field: { marginBottom: 14 },
  label: {
    color: colors.accentGlow,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 6,
    fontWeight: "800",
  },
  input: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multiline: { height: 72 },
});

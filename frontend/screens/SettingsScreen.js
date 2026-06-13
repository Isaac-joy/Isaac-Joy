import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { PRIVACY_URL } from "../config";
import { colors, gradients } from "../theme";
import GradientBackground from "../components/GradientBackground";
import GlowCard from "../components/GlowCard";
import NeonButton from "../components/NeonButton";
import FadeIn from "../components/FadeIn";

const FIELDS = [
  { key: "name", label: "Name" },
  { key: "age", label: "Age", numeric: "int" },
  { key: "occupation", label: "Occupation" },
  { key: "education_level", label: "Education level / class" },
  { key: "interests", label: "Interests", multiline: true },
  { key: "academic_goal", label: "Intellectual goal", multiline: true },
  { key: "financial_system", label: "Financial system", multiline: true },
  { key: "wealth_goal", label: "Wealth goal", multiline: true },
  { key: "weight", label: "Weight (kg)", numeric: "float" },
  { key: "height", label: "Height (cm)", numeric: "float" },
  { key: "physical_goal", label: "Physical goal", multiline: true },
  { key: "equipment", label: "Available equipment", multiline: true },
];

export default function SettingsScreen() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await api.getProfile();
      const f = {};
      for (const fld of FIELDS) {
        const v = p?.[fld.key];
        f[fld.key] = v === null || v === undefined ? "" : String(v);
      }
      setForm(f);
    } catch (_) {
      // leave blank
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const payload = {};
      for (const fld of FIELDS) {
        const raw = form[fld.key];
        if (raw === undefined) continue;
        if (fld.numeric === "int") payload[fld.key] = raw === "" ? null : parseInt(raw, 10);
        else if (fld.numeric === "float") payload[fld.key] = raw === "" ? null : parseFloat(raw);
        else payload[fld.key] = raw;
      }
      await api.updateProfile(payload);
      Alert.alert("Saved", "The System has updated your profile. It will tailor accordingly.");
    } catch (e) {
      Alert.alert("Could not save", e.message || String(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (pw.length < 6) {
      Alert.alert("Too short", "Password must be at least 6 characters.");
      return;
    }
    if (pw !== pw2) {
      Alert.alert("Mismatch", "The two passwords don't match.");
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw("");
      setPw2("");
      Alert.alert("Done", "Your password has been changed.");
    } catch (e) {
      Alert.alert("Could not change password", e.message || String(e));
    } finally {
      setSavingPw(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently erases your account and ALL your data — profile, logs, stats, missions, books, everything. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: () =>
            Alert.alert("Are you absolutely sure?", "There is no recovery.", [
              { text: "Keep my account", style: "cancel" },
              {
                text: "Delete forever",
                style: "destructive",
                onPress: async () => {
                  try {
                    await api.deleteAccount();
                    await supabase.auth.signOut();
                  } catch (e) {
                    Alert.alert("Deletion failed", e.message || String(e));
                  }
                },
              },
            ]),
        },
      ]
    );
  }

  if (loading) {
    return (
      <GradientBackground>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Edit profile */}
        <FadeIn>
          <Text style={styles.section}>YOUR PROFILE</Text>
          <Text style={styles.sectionHint}>
            The System tailors missions, study, and career guidance to these.
          </Text>
          <GlowCard style={styles.card}>
            {FIELDS.map((f) => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.label}>{f.label.toUpperCase()}</Text>
                <TextInput
                  style={[styles.input, f.multiline && styles.multiline]}
                  placeholder={f.label}
                  placeholderTextColor={colors.textDim}
                  keyboardType={f.numeric ? "numeric" : "default"}
                  multiline={!!f.multiline}
                  value={form[f.key] ?? ""}
                  onChangeText={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                  textAlignVertical={f.multiline ? "top" : "center"}
                />
              </View>
            ))}
            <NeonButton
              title={savingProfile ? "SAVING" : "SAVE PROFILE"}
              onPress={saveProfile}
              busy={savingProfile}
              style={{ marginTop: 4 }}
            />
          </GlowCard>
        </FadeIn>

        {/* Security */}
        <FadeIn delay={60}>
          <Text style={styles.section}>SECURITY</Text>
          <GlowCard style={styles.card}>
            <Text style={styles.label}>NEW PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textDim}
              secureTextEntry
              value={pw}
              onChangeText={setPw}
            />
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter"
              placeholderTextColor={colors.textDim}
              secureTextEntry
              value={pw2}
              onChangeText={setPw2}
            />
            <NeonButton
              title={savingPw ? "UPDATING" : "CHANGE PASSWORD"}
              onPress={changePassword}
              busy={savingPw}
              grad={gradients.cyan}
              glow={colors.cyan}
            />
          </GlowCard>
        </FadeIn>

        {/* About / legal */}
        <FadeIn delay={120}>
          <Text style={styles.section}>ABOUT</Text>
          <GlowCard style={styles.card}>
            <Text
              style={styles.link}
              onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.accentGlow} />  Privacy Policy
            </Text>
            <Text style={styles.disclaimer}>
              All Council verdicts, missions, study plans, and career guidance are
              AI-generated and for motivation only — not professional medical, financial,
              legal, or career advice.
            </Text>
          </GlowCard>
        </FadeIn>

        {/* Account actions */}
        <FadeIn delay={180}>
          <NeonButton
            title="SIGN OUT"
            onPress={() => supabase.auth.signOut()}
            grad={[colors.surfaceAlt, colors.surface]}
            glow={colors.border}
            textStyle={{ color: colors.text }}
            style={{ marginTop: 18 }}
          />

          <Text style={styles.section}>DANGER ZONE</Text>
          <View style={styles.dangerCard}>
            <Text style={styles.dangerText}>
              Permanently delete your account and all data. This cannot be undone.
            </Text>
            <Text style={styles.dangerBtn} onPress={confirmDelete}>
              DELETE MY ACCOUNT
            </Text>
          </View>
          <View style={{ height: 40 }} />
        </FadeIn>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 20, paddingBottom: 30 },
  section: {
    color: colors.textDim,
    fontSize: 12,
    letterSpacing: 2.5,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 22,
  },
  sectionHint: { color: colors.textDim, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  card: { marginBottom: 4 },
  field: { marginBottom: 12 },
  label: {
    color: colors.accentGlow,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  multiline: { height: 70 },
  link: { color: colors.accentGlow, fontSize: 15, fontWeight: "700", marginBottom: 12 },
  disclaimer: { color: colors.textDim, fontSize: 12, lineHeight: 18, fontStyle: "italic" },
  dangerCard: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.5)",
    borderRadius: 14,
    padding: 16,
    marginTop: 6,
  },
  dangerText: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  dangerBtn: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 13,
  },
});

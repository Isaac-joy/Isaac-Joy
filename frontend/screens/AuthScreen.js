import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";
import { colors, fonts, gradients } from "../theme";
import GradientBackground from "../components/GradientBackground";
import NeonButton from "../components/NeonButton";
import FadeIn from "../components/FadeIn";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert("Missing", "Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (/invalid login/i.test(error.message)) {
            Alert.alert(
              "Wrong email or password",
              "Double-check your details, or tap “Forgot password?” to reset it."
            );
            return;
          }
          throw error;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          if (/already|registered|exists/i.test(error.message)) {
            Alert.alert(
              "Account already exists",
              "This email is already registered. Switching you to Sign In — just enter your password."
            );
            setMode("signin");
            return;
          }
          throw error;
        }
        if (!data.session) {
          Alert.alert(
            "Confirm your email",
            "Account created. Check your inbox for a confirmation link, then sign in."
          );
          setMode("signin");
        }
      }
    } catch (e) {
      Alert.alert("Authentication failed", e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      Alert.alert("Enter your email", "Type your email above first, then tap reset.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      Alert.alert(
        "Check your email",
        "If an account exists for this email, a password-reset link is on its way."
      );
    } catch (e) {
      Alert.alert("Could not send reset", e.message || String(e));
    }
  }

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <FadeIn style={styles.inner}>
          <Text style={styles.brand}>SOLO LEVELING</Text>
          <Text style={styles.brandSub}>// COUNCIL</Text>
          <Text style={styles.tagline}>Report to the System. Rise, or regress.</Text>

          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textDim}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <NeonButton
              title={mode === "signin" ? "ENTER" : "AWAKEN"}
              onPress={submit}
              busy={busy}
              grad={mode === "signin" ? gradients.accent : gradients.violet}
              glow={mode === "signin" ? colors.accentGlow : colors.violet}
              style={{ marginTop: 4 }}
            />
          </View>

          <TouchableOpacity
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
            style={styles.toggleWrap}
          >
            <Text style={styles.toggle}>
              {mode === "signin"
                ? "No account? Awaken one  →"
                : "Already awakened? Sign in  →"}
            </Text>
          </TouchableOpacity>

          {mode === "signin" ? (
            <TouchableOpacity onPress={forgotPassword} style={styles.forgotWrap}>
              <Text style={styles.forgot}>Forgot password?</Text>
            </TouchableOpacity>
          ) : null}
        </FadeIn>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
  inner: { paddingHorizontal: 28 },
  brand: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 5,
    textAlign: "center",
    textShadowColor: colors.accent,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  brandSub: {
    color: colors.accentGlow,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    marginTop: 2,
  },
  tagline: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 30,
  },
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    borderRadius: 18,
    padding: 20,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 14,
  },
  toggleWrap: { marginTop: 22, alignItems: "center" },
  toggle: { color: colors.accentGlow, fontSize: 14, fontFamily: fonts.mono },
  forgotWrap: { marginTop: 14, alignItems: "center" },
  forgot: { color: colors.textDim, fontSize: 13 },
});

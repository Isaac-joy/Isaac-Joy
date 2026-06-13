import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "../lib/api";
import { colors } from "../theme";
import GradientBackground from "../components/GradientBackground";
import NeonButton from "../components/NeonButton";
import FadeIn from "../components/FadeIn";

const POLL_MS = 5000;
const TIMEOUT_MS = 120000;

export default function DailyLogScreen({ navigation }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | evaluating | timeout
  const timers = useRef([]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
  }, []);

  async function submit() {
    if (!text.trim()) {
      Alert.alert("Empty report", "Write your day before submitting.");
      return;
    }
    setPhase("evaluating");
    try {
      let baseline = null;
      try {
        const before = await api.getQuests();
        baseline = (before && before.created_at) || null;
      } catch (_) {}

      await api.submitLog(text.trim());

      const start = Date.now();
      const poll = async () => {
        if (Date.now() - start > TIMEOUT_MS) {
          setPhase("timeout");
          return;
        }
        try {
          const q = await api.getQuests();
          const fresh = q && q.created_at && q.created_at !== baseline;
          if (fresh) {
            setPhase("idle");
            setText("");
            navigation.navigate("Main", { screen: "Dashboard" });
            return;
          }
        } catch (_) {}
        timers.current.push(setTimeout(poll, POLL_MS));
      };
      timers.current.push(setTimeout(poll, POLL_MS));
    } catch (e) {
      setPhase("idle");
      if (e.status === 429) {
        Alert.alert("The Council rests", "Daily submission limit reached. Return tomorrow.");
      } else {
        Alert.alert("Submission failed", e.message || String(e));
      }
    }
  }

  if (phase === "evaluating") {
    return (
      <GradientBackground>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.evalTitle}>THE COUNCIL CONVENES</Text>
          <Text style={styles.evalSub}>
            The Architect, the Tycoon, and the Beast are auditing your day. The System will
            deliver its verdict shortly.
          </Text>
        </View>
      </GradientBackground>
    );
  }

  if (phase === "timeout") {
    return (
      <GradientBackground>
        <View style={styles.center}>
          <Text style={styles.evalTitle}>STILL DELIBERATING</Text>
          <Text style={styles.evalSub}>
            The verdict is taking longer than usual. It will appear on your dashboard once
            ready.
          </Text>
          <NeonButton
            title="BACK TO DASHBOARD"
            onPress={() => {
              setPhase("idle");
              navigation.navigate("Main", { screen: "Dashboard" });
            }}
            style={{ marginTop: 24, alignSelf: "stretch" }}
          />
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <FadeIn style={styles.inner}>
          <Text style={styles.prompt}>Report your day to the Council. Hold nothing back.</Text>
          <TextInput
            style={styles.input}
            placeholder="Today I..."
            placeholderTextColor={colors.textDim}
            multiline
            value={text}
            onChangeText={setText}
            textAlignVertical="top"
          />
          <NeonButton title="SUBMIT TO THE COUNCIL" onPress={submit} />
        </FadeIn>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 20 },
  prompt: { color: colors.textDim, fontSize: 14, marginBottom: 14 },
  input: {
    flex: 1,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    borderRadius: 14,
    color: colors.text,
    padding: 16,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  evalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
    marginTop: 24,
    textAlign: "center",
    textShadowColor: colors.accent,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  evalSub: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
});

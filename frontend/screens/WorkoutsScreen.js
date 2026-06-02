import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../lib/api";
import { colors, fonts, gradients } from "../theme";
import GradientBackground from "../components/GradientBackground";
import GlowCard from "../components/GlowCard";
import NeonButton from "../components/NeonButton";
import ExerciseCard from "../components/ExerciseCard";
import FadeIn from "../components/FadeIn";

export default function WorkoutsScreen() {
  const [equipment, setEquipment] = useState("");
  const [savedEquipment, setSavedEquipment] = useState("");
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const burstY = useRef(new Animated.Value(0)).current;
  const burstO = useRef(new Animated.Value(0)).current;
  const [burstText, setBurstText] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, w] = await Promise.all([api.getProfile(), api.getWorkout()]);
      const eq = (p && p.equipment) || "";
      setEquipment(eq);
      setSavedEquipment(eq);
      setWorkout(w && w.id ? w : null);
    } catch (_) {
      // keep prior data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function fireBurst(xp) {
    setBurstText(`+${xp} XP`);
    burstY.setValue(0);
    burstO.setValue(1);
    Animated.parallel([
      Animated.timing(burstY, { toValue: -90, duration: 950, useNativeDriver: true }),
      Animated.timing(burstO, { toValue: 0, duration: 950, useNativeDriver: true }),
    ]).start();
  }

  async function saveEquipmentIfChanged() {
    if (equipment.trim() !== savedEquipment.trim()) {
      await api.updateProfile({ equipment: equipment.trim() });
      setSavedEquipment(equipment.trim());
    }
  }

  async function forge(regenerate) {
    setGenerating(true);
    try {
      await saveEquipmentIfChanged();
      const w = regenerate ? await api.regenerateWorkout() : await api.generateWorkout();
      setWorkout(w && w.id ? w : null);
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function complete() {
    if (!workout || workout.status === "completed") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    fireBurst(workout.xp_reward ?? 60);
    setWorkout((w) => ({ ...w, status: "completed" }));
    try {
      await api.completeWorkout(workout.id);
    } catch (e) {
      setWorkout((w) => ({ ...w, status: "active" }));
      Alert.alert("Could not complete", e.message || String(e));
    }
  }

  const exercises = (workout && workout.exercises) || [];
  const done = workout && workout.status === "completed";

  return (
    <GradientBackground>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.accent}
            />
          }
        >
          <FadeIn>
            <Text style={styles.hero}>THE FORGE</Text>
            <Text style={styles.heroSub}>
              The System builds each session around your goal and the gear you have.
            </Text>
          </FadeIn>

          {/* Equipment */}
          <FadeIn delay={70}>
            <GlowCard glow={colors.cyan} style={styles.eqCard}>
              <Text style={styles.label}>YOUR EQUIPMENT</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. dumbbells, pull-up bar — or leave blank for bodyweight"
                placeholderTextColor={colors.textDim}
                value={equipment}
                onChangeText={setEquipment}
                multiline
                textAlignVertical="top"
              />
            </GlowCard>
          </FadeIn>

          {/* XP burst */}
          <Animated.View
            pointerEvents="none"
            style={[styles.burst, { opacity: burstO, transform: [{ translateY: burstY }] }]}
          >
            <Text style={styles.burstText}>{burstText}</Text>
          </Animated.View>

          {!workout ? (
            <FadeIn delay={120}>
              <GlowCard style={styles.emptyCard} glow={colors.cyan}>
                <Ionicons name="barbell-outline" size={40} color={colors.cyan} />
                <Text style={styles.emptyTitle}>NO SESSION FORGED</Text>
                <Text style={styles.emptyText}>
                  Set your equipment above, then let the System forge today's training.
                </Text>
                <NeonButton
                  title={generating ? "FORGING" : "FORGE TODAY'S WORKOUT"}
                  onPress={() => forge(false)}
                  busy={generating}
                  grad={gradients.cyan}
                  glow={colors.cyan}
                  style={{ marginTop: 16, alignSelf: "stretch" }}
                />
              </GlowCard>
            </FadeIn>
          ) : (
            <>
              <FadeIn delay={120}>
                <View style={styles.planHead}>
                  <Text style={styles.planTitle}>{workout.title}</Text>
                  <Text style={styles.planMeta}>
                    {exercises.length} exercises{done ? "  ·  CLEARED ✓" : ""}
                  </Text>
                </View>
              </FadeIn>

              {exercises.map((e, i) => (
                <FadeIn key={i} delay={160 + i * 50}>
                  <ExerciseCard exercise={e} index={i} />
                </FadeIn>
              ))}

              <NeonButton
                title={done ? "WORKOUT CLEARED ✓" : `COMPLETE WORKOUT  ·  +${workout.xp_reward ?? 60} XP`}
                onPress={complete}
                disabled={done}
                grad={gradients.success}
                glow={colors.success}
                style={{ marginTop: 14 }}
              />
              <NeonButton
                title={generating ? "FORGING" : "⟲ NEW WORKOUT"}
                onPress={() => forge(true)}
                busy={generating}
                grad={gradients.cyan}
                glow={colors.cyan}
                style={{ marginTop: 10 }}
              />
            </>
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 20, paddingBottom: 40 },
  hero: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: 2 },
  heroSub: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 18 },
  eqCard: { marginBottom: 20 },
  label: {
    color: colors.cyan,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginBottom: 8,
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
    minHeight: 56,
  },
  emptyCard: { alignItems: "center" },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 12,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  planHead: { marginBottom: 14 },
  planTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
    textShadowColor: colors.cyan,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  planMeta: { color: colors.textDim, fontSize: 12, letterSpacing: 1, marginTop: 4, fontWeight: "700" },
  burst: { position: "absolute", top: "44%", alignSelf: "center" },
  burstText: {
    color: colors.success,
    fontSize: 30,
    fontWeight: "900",
    fontFamily: fonts.mono,
    textShadowColor: colors.success,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
});

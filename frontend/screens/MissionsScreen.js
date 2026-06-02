import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../lib/api";
import { catOf, colors, fonts, gradients } from "../theme";
import GradientBackground from "../components/GradientBackground";
import GlowCard from "../components/GlowCard";
import NeonButton from "../components/NeonButton";
import MissionCard from "../components/MissionCard";
import FadeIn from "../components/FadeIn";

const CATS = ["intellect", "wealth", "strength", "general"];
const EMPTY_FORM = { title: "", description: "", category: "general" };

export default function MissionsScreen() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Modal / form state
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  // XP burst
  const burstY = useRef(new Animated.Value(0)).current;
  const burstO = useRef(new Animated.Value(0)).current;
  const [burstText, setBurstText] = useState("");

  const load = useCallback(async () => {
    try {
      const rows = await api.getMissions();
      setMissions(Array.isArray(rows) ? rows : []);
    } catch (_) {
      // keep prior data on a transient failure
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

  async function summon() {
    setGenerating(true);
    try {
      await api.generateMissions();
      await load();
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function toggleComplete(m) {
    if (m.status === "completed") return; // forward-only
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    fireBurst(m.xp_reward ?? 0);
    setMissions((list) =>
      list.map((x) => (x.id === m.id ? { ...x, status: "completed" } : x))
    );
    try {
      await api.completeMission(m.id);
    } catch (e) {
      setMissions((list) =>
        list.map((x) => (x.id === m.id ? { ...x, status: "active" } : x))
      );
      Alert.alert("Could not complete", e.message || String(e));
    }
  }

  function confirmDelete(m) {
    Alert.alert("Abandon mission?", `"${m.title}"`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Abandon",
        style: "destructive",
        onPress: async () => {
          setMissions((list) => list.filter((x) => x.id !== m.id));
          try {
            await api.deleteMission(m.id);
          } catch (e) {
            Alert.alert("Could not delete", e.message || String(e));
            load();
          }
        },
      },
    ]);
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSuggestion(null);
    setModal(true);
  }

  function openEdit(m) {
    setEditing(m);
    setForm({
      title: m.title || "",
      description: m.description || "",
      category: m.category || "general",
    });
    setSuggestion(null);
    setModal(true);
  }

  async function polish() {
    if (!form.title.trim()) {
      Alert.alert("Write something first", "The System needs a draft to sharpen.");
      return;
    }
    setPolishing(true);
    setSuggestion(null);
    try {
      const s = await api.polishMission({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
      });
      setSuggestion(s);
    } catch (e) {
      Alert.alert("The System could not respond", e.message || String(e));
    } finally {
      setPolishing(false);
    }
  }

  function acceptSuggestion() {
    if (!suggestion) return;
    setForm((f) => ({
      ...f,
      title: suggestion.title || f.title,
      description: suggestion.description || f.description,
    }));
    setSuggestion(null);
  }

  async function save() {
    if (!form.title.trim()) {
      Alert.alert("Missing title", "Give the mission a name.");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
    };
    try {
      if (editing) await api.editMission(editing.id, payload);
      else await api.addMission(payload);
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert("Could not save", e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  const activeCount = missions.filter((m) => m.status !== "completed").length;
  const doneCount = missions.length - activeCount;

  const Header = (
    <View>
      <FadeIn>
        <Text style={styles.hero}>THE SYSTEM'S DIRECTIVES</Text>
        <Text style={styles.heroSub}>
          Issued daily, calibrated to your goals. Complete them — or answer for it.
        </Text>
      </FadeIn>

      <FadeIn delay={80}>
        <View style={styles.statusRow}>
          <View style={styles.counts}>
            <Text style={styles.countActive}>{activeCount} ACTIVE</Text>
            <Text style={styles.countDot}>•</Text>
            <Text style={styles.countDone}>{doneCount} CLEARED</Text>
          </View>
          <NeonButton
            title={generating ? "SUMMONING" : "⟲ SUMMON TODAY"}
            onPress={summon}
            busy={generating}
            small
            grad={gradients.violet}
            glow={colors.violet}
          />
        </View>
      </FadeIn>
    </View>
  );

  const Empty = !loading ? (
    <FadeIn delay={120}>
      <GlowCard style={styles.emptyCard} glow={colors.violet}>
        <Ionicons name="flash-outline" size={40} color={colors.violet} />
        <Text style={styles.emptyTitle}>NO ACTIVE DIRECTIVES</Text>
        <Text style={styles.emptyText}>
          Summon today's missions and the System will forge a path from your goals — or
          add your own and let it sharpen them.
        </Text>
        <NeonButton
          title={generating ? "SUMMONING" : "SUMMON TODAY'S MISSIONS"}
          onPress={summon}
          busy={generating}
          grad={gradients.violet}
          glow={colors.violet}
          style={{ marginTop: 16, alignSelf: "stretch" }}
        />
      </GlowCard>
    </FadeIn>
  ) : null;

  return (
    <GradientBackground>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={missions}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => (
            <MissionCard
              mission={item}
              onToggle={() => toggleComplete(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
          ListHeaderComponent={Header}
          ListEmptyComponent={Empty}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      )}

      {/* XP burst */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.burst,
          { opacity: burstO, transform: [{ translateY: burstY }] },
        ]}
      >
        <Text style={styles.burstText}>{burstText}</Text>
      </Animated.View>

      {/* Floating add button */}
      <Pressable style={styles.fab} onPress={openAdd}>
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Ionicons name="add" size={30} color="#04122E" />
        </LinearGradient>
      </Pressable>

      {/* Add / Edit modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <Pressable style={styles.backdrop} onPress={() => setModal(false)} />
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                {editing ? "EDIT MISSION" : "NEW MISSION"}
              </Text>

              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ship the landing page"
                placeholderTextColor={colors.textDim}
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              />

              <Text style={styles.label}>DETAILS</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="What exactly will you do?"
                placeholderTextColor={colors.textDim}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>CATEGORY</Text>
              <View style={styles.catRow}>
                {CATS.map((c) => {
                  const cat = catOf(c);
                  const on = form.category === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setForm((f) => ({ ...f, category: c }))}
                      style={[
                        styles.catChip,
                        { borderColor: on ? cat.color : colors.border },
                        on && { backgroundColor: "rgba(96,165,250,0.10)" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipTxt,
                          { color: on ? cat.color : colors.textDim },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* System polish */}
              <Pressable
                style={styles.polishBtn}
                onPress={polish}
                disabled={polishing}
              >
                <Ionicons name="sparkles" size={15} color={colors.violet} />
                <Text style={styles.polishTxt}>
                  {polishing ? "THE SYSTEM IS THINKING…" : "LET THE SYSTEM POLISH IT"}
                </Text>
              </Pressable>

              {suggestion ? (
                <View style={styles.suggestion}>
                  <Text style={styles.suggLabel}>⟡ THE SYSTEM SUGGESTS</Text>
                  <Text style={styles.suggTitle}>{suggestion.title}</Text>
                  {suggestion.description ? (
                    <Text style={styles.suggDesc}>{suggestion.description}</Text>
                  ) : null}
                  {suggestion.rationale ? (
                    <Text style={styles.suggWhy}>“{suggestion.rationale}”</Text>
                  ) : null}
                  <View style={styles.suggBtns}>
                    <NeonButton
                      title="USE THIS"
                      onPress={acceptSuggestion}
                      small
                      grad={gradients.violet}
                      glow={colors.violet}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Pressable style={styles.keepBtn} onPress={() => setSuggestion(null)}>
                      <Text style={styles.keepTxt}>KEEP MINE</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <NeonButton
                title={editing ? "SAVE CHANGES" : "ADD MISSION"}
                onPress={save}
                busy={saving}
                style={{ marginTop: 18 }}
              />
              <Pressable style={styles.cancelBtn} onPress={() => setModal(false)}>
                <Text style={styles.cancelTxt}>CANCEL</Text>
              </Pressable>
              <View style={{ height: 12 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 20, paddingBottom: 120 },
  hero: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroSub: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 18,
  },
  counts: { flexDirection: "row", alignItems: "center" },
  countActive: { color: colors.accentGlow, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  countDot: { color: colors.textDim, marginHorizontal: 8 },
  countDone: { color: colors.success, fontSize: 12, fontWeight: "800", letterSpacing: 1 },

  emptyCard: { alignItems: "center", marginTop: 10 },
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

  burst: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
  },
  burstText: {
    color: colors.success,
    fontSize: 30,
    fontWeight: "900",
    fontFamily: fonts.mono,
    textShadowColor: colors.success,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },

  fab: {
    position: "absolute",
    right: 22,
    bottom: 26,
    borderRadius: 30,
    shadowColor: colors.accentGlow,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2,4,10,0.72)" },
  sheet: {
    backgroundColor: colors.bgAlt,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "90%",
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 16,
  },
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
    marginBottom: 14,
  },
  multiline: { height: 88 },
  catRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  catChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  catChipTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  polishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.violet,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  polishTxt: {
    color: colors.violet,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginLeft: 8,
  },
  suggestion: {
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.4)",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  suggLabel: {
    color: colors.violet,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  suggTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  suggDesc: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 6 },
  suggWhy: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 17,
  },
  suggBtns: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  keepBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  keepTxt: { color: colors.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 1 },

  cancelBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  cancelTxt: { color: colors.textDim, fontSize: 13, letterSpacing: 1.5, fontWeight: "700" },
});

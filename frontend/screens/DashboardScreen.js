import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../lib/api";
import { colors, fonts, gradients } from "../theme";
import StatBar from "../components/StatBar";
import QuestCard from "../components/QuestCard";
import GradientBackground from "../components/GradientBackground";
import GlowCard from "../components/GlowCard";
import NeonButton from "../components/NeonButton";
import FadeIn from "../components/FadeIn";
import HunterStatus, { RANK_ORDER, RANK_COLOR } from "../components/HunterStatus";
import GateCard from "../components/GateCard";
import CouncilDebate from "../components/CouncilDebate";

export default function DashboardScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [quests, setQuests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rankUp, setRankUp] = useState(null);
  const [gate, setGate] = useState(null);
  const [gateBusy, setGateBusy] = useState(false);
  const overlay = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const [p, q, gt] = await Promise.all([api.getProfile(), api.getQuests(), api.getGate()]);
      setProfile(p || {});
      setQuests(q || {});
      setGate(gt || {});
      // Rank-up moment: compare against the last rank we showed this device.
      if (p && p.rank) {
        const seen = await AsyncStorage.getItem("lastRank");
        if (seen && RANK_ORDER.indexOf(p.rank) > RANK_ORDER.indexOf(seen)) {
          setRankUp(p.rank);
        }
        await AsyncStorage.setItem("lastRank", p.rank);
      }
    } catch (_) {
      // keep prior data on a background refresh
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

  useEffect(() => {
    if (!rankUp) return;
    overlay.setValue(0);
    Animated.spring(overlay, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
    const t = setTimeout(() => setRankUp(null), 4500);
    return () => clearTimeout(t);
  }, [rankUp, overlay]);

  function reportVerdict(text) {
    Alert.alert(
      "Report this response?",
      "Flag this AI-generated verdict as inappropriate or incorrect?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: async () => {
            try {
              await api.reportContent("verdict", text || "");
              Alert.alert("Thank you", "The System has logged your report for review.");
            } catch (e) {
              Alert.alert("Could not report", e.message || String(e));
            }
          },
        },
      ]
    );
  }

  async function openGate() {
    setGateBusy(true);
    try {
      const g = await api.openGate();
      setGate(g || {});
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setGateBusy(false);
    }
  }

  async function regenerateGate() {
    setGateBusy(true);
    try {
      const g = await api.regenerateGate();
      setGate(g || {});
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setGateBusy(false);
    }
  }

  async function toggleObjective(index) {
    if (!gate || !gate.id) return;
    const prev = gate;
    const objs = (gate.objectives || []).map((o, i) =>
      i === index ? { ...o, done: !o.done } : o
    );
    setGate({ ...gate, objectives: objs });
    try {
      const r = await api.toggleGateObjective(gate.id, index);
      if (r.cleared) {
        Alert.alert("⟔ GATE CLEARED", `+${r.reward_xp} XP. The System acknowledges your conquest.`);
        load();
      } else {
        setGate((cur) => ({
          ...cur,
          objectives: r.objectives || objs,
          status: r.status || cur.status,
        }));
      }
    } catch (e) {
      setGate(prev);
      Alert.alert("Could not update", e.message || String(e));
    }
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

  const stats = profile || {};
  const verdict = quests && quests.system_verdict;
  const activeQuests = (quests && quests.quests) || [];
  const hunterName = stats.name || "Hunter";

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
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
          <Text style={styles.kicker}>HUNTER</Text>
          <Text style={styles.hello}>{hunterName.toUpperCase()}</Text>
        </FadeIn>

        <FadeIn delay={40}>
          <HunterStatus profile={stats} />
        </FadeIn>

        <FadeIn delay={55}>
          <GateCard
            gate={gate}
            onOpen={openGate}
            onToggle={toggleObjective}
            onRegenerate={regenerateGate}
            busy={gateBusy}
          />
        </FadeIn>

        <FadeIn delay={70}>
          <GlowCard style={styles.statsCard}>
            <StatBar label="INTELLECT" value={stats.intellect} color={colors.accent} grad={gradients.accent} />
            <StatBar label="WEALTH" value={stats.wealth} color={colors.gold} grad={gradients.gold} />
            <StatBar label="STRENGTH" value={stats.strength} color={colors.cyan} grad={gradients.cyan} />
          </GlowCard>
        </FadeIn>

        <FadeIn delay={140}>
          <Text style={styles.sectionTitle}>SYSTEM VERDICT</Text>
          <GlowCard accent={colors.gold} glow={colors.gold} style={styles.verdictCard}>
            <Text style={styles.verdictText}>
              {verdict || "No verdict yet. Report your day to the Council from the Report tab."}
            </Text>
            {verdict ? (
              <View style={styles.verdictFooter}>
                <Text style={styles.aiNote}>⚙ AI-generated · not professional advice</Text>
                <Pressable onPress={() => reportVerdict(verdict)} hitSlop={8}>
                  <Text style={styles.reportFlag}>⚑ Report</Text>
                </Pressable>
              </View>
            ) : null}
          </GlowCard>
        </FadeIn>

        {quests && quests.council ? (
          <FadeIn delay={170}>
            <CouncilDebate council={quests.council} />
          </FadeIn>
        ) : null}

        <FadeIn delay={200}>
          <Text style={styles.sectionTitle}>ACTIVE QUESTS</Text>
        </FadeIn>
        {activeQuests.length === 0 ? (
          <Text style={styles.empty}>No active quests. Submit a daily report to receive them.</Text>
        ) : (
          activeQuests.map((q, i) => (
            <FadeIn key={i} delay={240 + i * 50}>
              <QuestCard quest={q} />
            </FadeIn>
          ))
        )}

        <NeonButton
          title="＋ REPORT TODAY"
          onPress={() => navigation.navigate("Report")}
          style={{ marginTop: 10 }}
        />
      </ScrollView>

      {rankUp ? (
        <Pressable style={styles.rankUpWrap} onPress={() => setRankUp(null)}>
          <Animated.View
            style={[
              styles.rankUpCard,
              {
                opacity: overlay,
                transform: [{ scale: overlay.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
                borderColor: RANK_COLOR[rankUp] || colors.accent,
                shadowColor: RANK_COLOR[rankUp] || colors.accent,
              },
            ]}
          >
            <Text style={styles.rankUpKicker}>⟡ THE SYSTEM ANNOUNCES ⟡</Text>
            <Text style={styles.rankUpTitle}>RANK UP</Text>
            <Text
              style={[
                styles.rankUpRank,
                { color: RANK_COLOR[rankUp], textShadowColor: RANK_COLOR[rankUp] },
              ]}
            >
              {rankUp}
            </Text>
            <Text style={styles.rankUpSub}>You have risen to {rankUp}-Rank, Hunter.</Text>
            <Text style={styles.rankUpDismiss}>tap to dismiss</Text>
          </Animated.View>
        </Pressable>
      ) : null}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  kicker: { color: colors.textDim, fontSize: 11, letterSpacing: 3, fontWeight: "800" },
  hello: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 3,
    marginTop: 2,
    marginBottom: 18,
    textShadowColor: colors.accent,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  statsCard: { marginBottom: 24 },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 12,
    letterSpacing: 2.5,
    fontWeight: "800",
    marginBottom: 10,
  },
  verdictCard: { marginBottom: 24 },
  verdictText: { color: colors.text, fontSize: 14, lineHeight: 21, fontStyle: "italic" },
  verdictFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  aiNote: { color: colors.textFaint, fontSize: 10, flex: 1 },
  reportFlag: { color: colors.textDim, fontSize: 11, fontWeight: "700", paddingLeft: 8 },
  empty: { color: colors.textDim, fontSize: 14, marginBottom: 24 },

  rankUpWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,4,10,0.86)",
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  rankUpCard: {
    alignItems: "center",
    backgroundColor: colors.glass,
    borderWidth: 2,
    borderRadius: 22,
    paddingVertical: 34,
    paddingHorizontal: 40,
    shadowOpacity: 0.8,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  rankUpKicker: { color: colors.textDim, fontSize: 11, letterSpacing: 2, fontWeight: "800" },
  rankUpTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 6,
    marginTop: 10,
  },
  rankUpRank: {
    fontSize: 96,
    fontWeight: "900",
    fontFamily: fonts.mono,
    textShadowRadius: 30,
    textShadowOffset: { width: 0, height: 0 },
    marginVertical: 6,
  },
  rankUpSub: { color: colors.text, fontSize: 14, fontWeight: "700", textAlign: "center" },
  rankUpDismiss: { color: colors.textDim, fontSize: 11, marginTop: 16, letterSpacing: 1 },
});

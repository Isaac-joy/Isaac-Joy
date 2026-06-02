import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../lib/api";
import { colors, gradients } from "../theme";
import StatBar from "../components/StatBar";
import QuestCard from "../components/QuestCard";
import GradientBackground from "../components/GradientBackground";
import GlowCard from "../components/GlowCard";
import NeonButton from "../components/NeonButton";
import FadeIn from "../components/FadeIn";

export default function DashboardScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [quests, setQuests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, q] = await Promise.all([api.getProfile(), api.getQuests()]);
      setProfile(p || {});
      setQuests(q || {});
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
          </GlowCard>
        </FadeIn>

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
  empty: { color: colors.textDim, fontSize: 14, marginBottom: 24 },
});

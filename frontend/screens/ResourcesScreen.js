import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../lib/api";
import { colors, gradients } from "../theme";
import GradientBackground from "../components/GradientBackground";
import GlowCard from "../components/GlowCard";
import NeonButton from "../components/NeonButton";
import ResourceCard from "../components/ResourceCard";
import FadeIn from "../components/FadeIn";

export default function ResourcesScreen() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await api.getResources();
      setResources(Array.isArray(rows) ? rows : []);
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

  async function generate() {
    setBusy(true);
    try {
      const rows = await api.generateResources();
      setResources(Array.isArray(rows) ? rows : []);
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    try {
      const rows = await api.refreshResources();
      setResources(Array.isArray(rows) ? rows : []);
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const Header = (
    <View>
      <FadeIn>
        <Text style={styles.hero}>THE ARMORY</Text>
        <Text style={styles.heroSub}>
          Weapons for the mind, the wallet, and the body — curated by the System for your goals.
        </Text>
      </FadeIn>
      {resources.length > 0 ? (
        <FadeIn delay={70}>
          <NeonButton
            title={busy ? "CURATING" : "⟲ NEW RECOMMENDATIONS"}
            onPress={refresh}
            busy={busy}
            small
            grad={gradients.violet}
            glow={colors.violet}
            style={{ alignSelf: "flex-start", marginBottom: 16 }}
          />
        </FadeIn>
      ) : null}
    </View>
  );

  const Empty = !loading ? (
    <FadeIn delay={120}>
      <GlowCard style={styles.emptyCard} glow={colors.violet}>
        <Ionicons name="library-outline" size={40} color={colors.violet} />
        <Text style={styles.emptyTitle}>THE ARMORY IS EMPTY</Text>
        <Text style={styles.emptyText}>
          Ask the System to curate books, courses, and tools matched to your goals.
        </Text>
        <NeonButton
          title={busy ? "CURATING" : "GET RECOMMENDATIONS"}
          onPress={generate}
          busy={busy}
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
          data={resources}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item, index }) => (
            <FadeIn delay={Math.min(index * 40, 240)}>
              <ResourceCard resource={item} />
            </FadeIn>
          )}
          ListHeaderComponent={Header}
          ListEmptyComponent={Empty}
          contentContainerStyle={styles.content}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      )}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 20, paddingBottom: 40 },
  hero: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: 2 },
  heroSub: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 16 },
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
});

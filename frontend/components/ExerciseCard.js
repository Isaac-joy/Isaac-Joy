import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts } from "../theme";

// Cross-fades between the start/end demo photos to simulate the movement.
function ExerciseMotion({ images }) {
  const fade = useRef(new Animated.Value(0)).current;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (images.length < 2) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 700, delay: 500, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 700, delay: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [images, fade]);

  if (failed || images.length === 0) return null;

  return (
    <View style={styles.motionWrap}>
      <Animated.Image
        source={{ uri: images[0] }}
        style={styles.motionImg}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
      {images.length > 1 ? (
        <Animated.Image
          source={{ uri: images[1] }}
          style={[styles.motionImg, StyleSheet.absoluteFill, { opacity: fade }]}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

export default function ExerciseCard({ exercise, index }) {
  const e = exercise || {};
  const sets = e.sets ? `${e.sets} ${e.sets === 1 ? "set" : "sets"}` : "";
  const rep = e.reps ? `${e.reps} reps` : e.duration || "";
  const metric = [sets, rep].filter(Boolean).join("  ·  ");
  const images = Array.isArray(e.images) ? e.images : [];

  return (
    <View style={styles.card}>
      {images.length > 0 ? <ExerciseMotion images={images} /> : null}
      <View style={styles.row}>
        <View style={styles.numWrap}>
          <Text style={styles.num}>{String(index + 1).padStart(2, "0")}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.headRow}>
            <Text style={styles.name}>{e.name}</Text>
            {e.target ? (
              <View style={styles.chip}>
                <Text style={styles.chipTxt}>{String(e.target).toUpperCase()}</Text>
              </View>
            ) : null}
          </View>

          {metric ? <Text style={styles.metric}>{metric}</Text> : null}

          {e.equipment ? (
            <View style={styles.tag}>
              <Ionicons name="barbell-outline" size={12} color={colors.textDim} />
              <Text style={styles.tagTxt}>{e.equipment}</Text>
            </View>
          ) : null}

          {e.notes ? <Text style={styles.notes}>“{e.notes}”</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    marginBottom: 10,
    overflow: "hidden",
  },
  motionWrap: {
    height: 170,
    backgroundColor: "#FFFFFF",
  },
  motionImg: { width: "100%", height: "100%" },
  row: { flexDirection: "row", padding: 14 },
  numWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "rgba(34,211,238,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  num: { color: colors.cyan, fontFamily: fonts.mono, fontWeight: "800", fontSize: 13 },
  body: { flex: 1 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipTxt: { color: colors.cyan, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  metric: {
    color: colors.accentGlow,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  tag: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  tagTxt: { color: colors.textDim, fontSize: 12, marginLeft: 4 },
  notes: { color: colors.textDim, fontSize: 12, fontStyle: "italic", marginTop: 6, lineHeight: 17 },
});

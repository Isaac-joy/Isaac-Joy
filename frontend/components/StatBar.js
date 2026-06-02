import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fonts, gradients } from "../theme";

// Stats start at 0 and drift +/-. Magnitude maps to a bar (|v| * 2, capped 100%).
// The fill animates to its width and the value carries a neon glow.
export default function StatBar({ label, value, color, grad }) {
  const v = typeof value === "number" ? value : 0;
  const pct = Math.min(100, Math.abs(v) * 2);
  const negative = v < 0;

  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, {
      toValue: pct,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [pct, w]);

  const width = w.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Text
          style={[
            styles.value,
            { color: negative ? colors.danger : color, textShadowColor: color },
          ]}
        >
          {v > 0 ? `+${v}` : v}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]}>
          <LinearGradient
            colors={negative ? gradients.danger : grad || [color, color]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fillInner}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 13, letterSpacing: 2.5, fontWeight: "800" },
  value: {
    fontSize: 16,
    fontFamily: fonts.mono,
    fontWeight: "700",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  track: {
    height: 9,
    backgroundColor: "rgba(36,48,73,0.6)",
    borderRadius: 5,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 5, overflow: "hidden" },
  fillInner: { flex: 1 },
});

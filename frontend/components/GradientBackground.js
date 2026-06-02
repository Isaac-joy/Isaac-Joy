import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors, gradients } from "../theme";

// Full-screen deep-space gradient with two faint neon "glow" blooms behind content.
export default function GradientBackground({ children, style }) {
  return (
    <LinearGradient
      colors={gradients.bg}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fill, style]}
    >
      <View pointerEvents="none" style={[styles.bloom, styles.bloomTop]} />
      <View pointerEvents="none" style={[styles.bloom, styles.bloomBottom]} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bloom: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    opacity: 0.14,
  },
  bloomTop: { top: -120, right: -100, backgroundColor: colors.accent },
  bloomBottom: { bottom: -140, left: -110, backgroundColor: colors.cyan },
});

import React from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "../theme";

// Glassmorphic card with a soft neon glow. `accent` adds a colored left edge.
export default function GlowCard({ children, style, glow = colors.accentGlow, accent }) {
  return (
    <View
      style={[
        styles.card,
        { shadowColor: glow },
        accent && { borderLeftWidth: 3, borderLeftColor: accent },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: 18,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
});

import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors, gradients } from "../theme";

// Gradient button with a press-scale animation and a neon glow halo.
export default function NeonButton({
  title,
  onPress,
  disabled = false,
  busy = false,
  grad = gradients.accent,
  glow = colors.accentGlow,
  style,
  textStyle,
  small = false,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  const off = disabled || busy;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() => !off && animate(0.96)}
        onPressOut={() => animate(1)}
        onPress={onPress}
        disabled={off}
      >
        <View style={[styles.halo, { shadowColor: glow }, off && styles.haloOff]}>
          <LinearGradient
            colors={off ? [colors.surfaceAlt, colors.surface] : grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.btn, small && styles.btnSmall]}
          >
            <Text
              style={[
                styles.txt,
                small && styles.txtSmall,
                off && { color: colors.textDim },
                textStyle,
              ]}
            >
              {busy ? "···" : title}
            </Text>
          </LinearGradient>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  halo: {
    borderRadius: 12,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  haloOff: { shadowOpacity: 0, elevation: 0 },
  btn: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSmall: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  txt: { color: "#04122E", fontSize: 15, fontWeight: "900", letterSpacing: 2 },
  txtSmall: { fontSize: 12, letterSpacing: 1.5 },
});

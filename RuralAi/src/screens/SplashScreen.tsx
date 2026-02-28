import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export default function SplashScreen() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const barW = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "70%"],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={28} color={colors.primary} />
          </View>
        </View>

        <Text style={styles.title}>Rural AI</Text>
        <Text style={styles.sub}>Your Digital Buddy</Text>
        <Text style={styles.sub}>आपका डिजिटल साथी</Text>

        <View style={styles.progressBlock}>
          <Text style={styles.loadingLabel}>LOADING EXPERIENCE...</Text>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: barW }]} />
          </View>
          <View style={styles.voiceFirst}>
            <Ionicons name="mic-outline" size={14} color={colors.muted} />
            <Text style={styles.voiceFirstText}>VOICE FIRST</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  logoWrap: { marginBottom: 18 },
  logoCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "#EAF7EF",
  },
  title: { ...typography.h1, color: colors.ink, marginTop: 6 },
  sub: { marginTop: 6, color: colors.muted, fontSize: 13, textAlign: "center" },

  progressBlock: { width: "100%", marginTop: 28, alignItems: "center" },
  loadingLabel: { ...typography.tiny, color: colors.muted, marginBottom: 10 },
  track: {
    width: "80%",
    height: 6,
    backgroundColor: "#E9EEF4",
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: { height: 6, backgroundColor: colors.primary, borderRadius: 999 },
  voiceFirst: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  voiceFirstText: { ...typography.tiny, color: colors.muted },
});
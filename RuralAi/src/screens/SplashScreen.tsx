import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { askDomains, ruralPalette as P } from "../theme/ruralPalette";

export default function SplashScreen() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["8%", "82%"],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>RURAL ECOSYSTEM PLATFORM</Text>
        <Text style={styles.hindi}>आवाज़ से चलने वाला ग्रामीण सहायक</Text>

        <View style={styles.heroWrap}>
          <View style={styles.heroHalo} />
          <View style={styles.heroRing}>
            <View style={styles.heroCore}>
              <Ionicons name="mic" size={54} color={P.surface} />
            </View>
          </View>
        </View>

        <Text style={styles.title}>Voice-first rural guidance</Text>
        <Text style={styles.subtitle}>
          Market prices, health, schemes, and knowledge in one assistant.
        </Text>

        <View style={styles.domainRow}>
          {askDomains.slice(0, 3).map((domain) => (
            <View key={domain.key} style={styles.domainChip}>
              <View style={[styles.domainDot, { backgroundColor: domain.bubble }]}>
                <Ionicons name={domain.icon} size={16} color={domain.iconColor} />
              </View>
              <Text style={styles.domainText}>{domain.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Loading experience</Text>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressHint}>Initializing voice, memory, and live data sync</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3.4,
    color: P.ink,
    textAlign: "center",
  },
  hindi: {
    marginTop: 14,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  heroWrap: {
    marginTop: 36,
    width: 210,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  heroHalo: {
    position: "absolute",
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: P.goldTint,
  },
  heroRing: {
    width: 174,
    height: 174,
    borderRadius: 87,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: P.gold,
    backgroundColor: P.surface,
  },
  heroCore: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: P.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: P.goldDark,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  title: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: P.mutedDark,
    textAlign: "center",
  },
  domainRow: {
    width: "100%",
    marginTop: 26,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  domainChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.lineSoft,
  },
  domainDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  domainText: {
    fontSize: 12,
    fontWeight: "800",
    color: P.ink,
  },
  progressCard: {
    width: "100%",
    marginTop: 32,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: P.goldDark,
    textAlign: "center",
  },
  track: {
    marginTop: 14,
    height: 10,
    borderRadius: 999,
    backgroundColor: P.bgWarm,
    overflow: "hidden",
  },
  fill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: P.gold,
  },
  progressHint: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    color: P.mutedDark,
    textAlign: "center",
  },
});

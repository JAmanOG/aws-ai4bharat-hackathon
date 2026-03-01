/**
 * Voice-first Home Screen — single unified dashboard.
 * Matches reference: Offline bar → title → big mic → module tiles → user badge.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useHealthCheck } from "../hooks/useData";

/* ────────────── Module config (matches reference images) ────────────── */

const MODULES = [
  { key: "agriculture", title: "Agriculture", icon: "leaf-outline", screen: "AgriMarket" },
  { key: "knowledge",   title: "Knowledge",   icon: "book-outline",  screen: "KnowledgeDashboard" },
  { key: "economics",   title: "Economics",    icon: "business-outline", screen: "SavingsNudge" },
  { key: "health",      title: "Health",       icon: "medkit-outline",   screen: "Module", params: { title: "HEALTH" } },
  { key: "infra",       title: "Infrastructure", icon: "git-network-outline", screen: "SyncStatus" },
] as const;

/* ────────────── Waveform bar animation ────────────── */

function WaveBar({ delay, active }: { delay: number; active: boolean }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 400, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, delay, anim]);

  return (
    <Animated.View
      style={[
        styles.waveBar,
        { transform: [{ scaleY: anim }], backgroundColor: active ? colors.primary : colors.border },
      ]}
    />
  );
}

/* ────────────── Component ────────────── */

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const synced = !health.error;

  /* Pulse ring animation for the mic */
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const handleMicPress = () => {
    nav.navigate("Voice");
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Offline / Sync status bar ── */}
      <View style={styles.statusBar}>
        <Ionicons name={synced ? "wifi" : "cloud-offline-outline"} size={14} color={synced ? colors.primary : colors.muted} />
        <Text style={styles.statusLabel}>{synced ? "Online" : "Offline"}</Text>
        <View style={styles.statusDivider} />
        <Ionicons name="sync-outline" size={13} color={synced ? colors.primary : colors.muted} />
        <Text style={styles.statusLabel}>{synced ? "All synced" : "Sync pending"}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Title ── */}
        <Text style={styles.platformTitle}>RURAL ECOSYSTEM PLATFORM</Text>

        {/* ── Big Mic Area ── */}
        <View style={styles.micArea}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse }] }]} />
          <Pressable
            style={styles.micBtn}
            onPress={handleMicPress}
            android_ripple={{ color: "rgba(255,255,255,0.2)", borderless: true }}
          >
            <Ionicons name="mic" size={36} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* ── Waveform ── */}
        <View style={styles.waveRow}>
          {[0, 60, 120, 40, 100, 20, 80, 140, 60, 0].map((d, i) => (
            <WaveBar key={i} delay={d} active={true} />
          ))}
        </View>

        {/* ── Tap to Speak ── */}
        <Text style={styles.tapLabel}>Tap to Speak</Text>
        <Text style={styles.tapHint}>Example: Ask about crop prices in Hindi...</Text>

        {/* ── Module tiles (2-col grid + last centered) ── */}
        <View style={styles.grid}>
          {MODULES.map((m, i) => (
            <Pressable
              key={m.key}
              style={[
                styles.tile,
                i === MODULES.length - 1 && MODULES.length % 2 !== 0 ? styles.tileFull : styles.tileHalf,
              ]}
              onPress={() => (m as any).params ? nav.navigate(m.screen, (m as any).params) : nav.navigate(m.screen)}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={m.icon as any} size={26} color={colors.ink} />
              </View>
              <Text style={styles.tileTitle}>{m.title}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* ── Bottom user avatar badge ── */}
      <View style={styles.bottomRow}>
        <Pressable style={styles.avatarBadge} onPress={() => nav.navigate("Profile")}>
          <Ionicons name="person" size={14} color={colors.muted} />
          <Text style={styles.avatarText}>Profile</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ────────────── Styles ────────────── */

const MIC_SIZE = 96;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },
  statusDivider: { width: 1, height: 12, backgroundColor: colors.border, marginHorizontal: 4 },

  scrollContent: { alignItems: "center", paddingBottom: 20, paddingHorizontal: 20 },

  platformTitle: {
    marginTop: 18,
    fontSize: 16,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: 1.5,
    textAlign: "center",
  },

  micArea: {
    marginTop: 28,
    width: MIC_SIZE + 40,
    height: MIC_SIZE + 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: MIC_SIZE + 36,
    height: MIC_SIZE + 36,
    borderRadius: (MIC_SIZE + 36) / 2,
    backgroundColor: "rgba(74,144,217,0.12)",
  },
  micBtn: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginTop: 14,
    height: 24,
  },
  waveBar: { width: 3, height: 20, borderRadius: 1.5 },

  tapLabel: { marginTop: 12, fontSize: 18, fontWeight: "800", color: colors.ink },
  tapHint: { marginTop: 4, fontSize: 12, fontWeight: "500", color: colors.muted, textAlign: "center" },

  grid: {
    marginTop: 26,
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tileHalf: { width: "48%" },
  tileFull: { width: "100%" },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(74,144,217,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: { fontSize: 12, fontWeight: "800", color: colors.ink, letterSpacing: 0.4 },

  bottomRow: { alignItems: "flex-end", paddingHorizontal: 20, paddingBottom: 8 },
  avatarBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: { fontSize: 11, fontWeight: "800", color: colors.muted },
});

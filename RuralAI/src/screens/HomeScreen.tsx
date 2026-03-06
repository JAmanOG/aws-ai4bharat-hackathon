import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useNavigation } from "@react-navigation/native";



export default function HomeScreen() {
  const nav = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="globe-outline" size={20} color={colors.ink} />
          </Pressable>

          <View style={styles.headerMid}>
            <Text style={styles.headerTitle}>Rural AI</Text>
            <View style={styles.syncPill}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText}>SYNCED</Text>
            </View>
          </View>

          <Pressable style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={20} color={colors.ink} />
          </Pressable>
        </View>

        {/* Mic CTA */}
        <View style={styles.micBlock}>
          <Pressable style={styles.micCircle} onPress={() => { console.log("[NAV] Navigating to AskScreen from HomeScreen"); nav.navigate("Ask"); }} android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}>
            <Ionicons name="mic" size={28} color={colors.ink} />
          </Pressable>
          <Text style={styles.tapText}>Tap to speak</Text>
        </View>

        {/* Daily Briefing */}
        <Text style={styles.sectionTitle}>Daily Briefing</Text>
        <View style={styles.briefCard}>
          <BriefItem icon="sunny-outline" label="Weather" />
          <BriefItem rupee label="Market" />
          <BriefItem icon="people-outline" label="Community" />
        </View>

        {/* Module tiles */}
        <View style={styles.grid}>
          {[
            { id: "HEALTH", title: "HEALTH", icon: "heart-outline", color: colors.primary },
            { id: "FINANCE", title: "FINANCE", icon: "cash-outline", color: "#8B5E3C" },
            { id: "INFRASTRUCTURE", title: "INFRASTRUCTURE", icon: "build-outline", color: "#8B5E3C" }
          ].map((item) => (
            <Pressable
              key={item.id}
              style={[styles.tile, styles.tileWide]}
              onPress={() => {
                console.log(`[NAV] Navigating to Module: ${item.id}`);
                nav.navigate("Module", { title: item.id });
              }}
            >
              <View style={[styles.tileIcon, { backgroundColor: item.color + "1A" }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tileText}>{item.title}</Text>
                <Text style={styles.tileHint}>Explore {item.title.toLowerCase()} services</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        {/* Saved data row */}
        <View style={styles.savedRow}>
          <View style={styles.savedLeft}>
            <Ionicons name="cloud-done-outline" size={16} color={colors.muted} />
            <Text style={styles.savedText}>Saved data ON</Text>
          </View>
          <Pressable style={styles.manageBtn}>
            <Text style={styles.manageText}>MANAGE</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function BriefItem({ icon, label, rupee }: { icon?: any; label: string; rupee?: boolean }) {
  return (
    <View style={styles.briefItem}>
      <View style={styles.briefIcon}>
        {rupee ? (
          <Text style={styles.rupee}>₹</Text>
        ) : (
          <Ionicons name={icon} size={18} color={colors.primary} />
        )}
      </View>
      <Text style={styles.briefLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  headerMid: { alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900", color: colors.ink },
  syncPill: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(19,236,91,0.14)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncText: { fontSize: 11, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },

  micBlock: { alignItems: "center", marginTop: 14, marginBottom: 10 },
  micCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  tapText: { marginTop: 10, color: colors.ink, fontWeight: "800" },

  sectionTitle: { fontSize: 20, fontWeight: "900", color: colors.ink, marginTop: 10, marginBottom: 10 },

  briefCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  briefItem: { alignItems: "center", width: "33%" },
  briefIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(19,236,91,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rupee: { color: colors.primary, fontSize: 18, fontWeight: "900" },
  briefLabel: { marginTop: 6, fontSize: 12, color: colors.ink, opacity: 0.85, fontWeight: "700" },

  grid: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },

  tile: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tileHalf: { width: "48%" },
  tileWide: { width: "100%" },
  tileText: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 0.6 },
  tileHint: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  savedRow: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  savedText: { color: colors.ink, fontSize: 12, fontWeight: "700" },

  manageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.35)",
    backgroundColor: "rgba(139,94,60,0.10)",
  },
  manageText: { fontSize: 11, fontWeight: "900", color: colors.earth, letterSpacing: 1 },
});
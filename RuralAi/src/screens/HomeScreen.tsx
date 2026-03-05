/**
 * Home Screen — main dashboard with offline bar, recent activity,
 * quick-access modules, and key stats.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useHealthCheck } from "../hooks/useData";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_W } = Dimensions.get("window");

/* ── Card list for quick navigation ── */
const MODULES = [
  { key: "agri", title: "Agriculture & Market", sub: "Live mandi prices, bargaining tools", icon: "leaf", screen: "AgriMarket", color: "#22C55E" },
  { key: "knowledge", title: "Knowledge Hub", sub: "Courses, peer groups, credentials", icon: "bulb", screen: "KnowledgeDashboard", color: "#F59E0B" },
  { key: "economic", title: "Economics & Savings", sub: "AI nudges, insurance, schemes", icon: "business", screen: "SavingsNudge", color: "#4A90D9" },
  { key: "health", title: "Health Check", sub: "Symptom checker, nearby care", icon: "heart-circle", screen: "SymptomChecker", color: "#EF4444" },
  { key: "sync", title: "Offline & Sync", sub: "Cached data, sync status", icon: "cloud-done", screen: "SyncStatus", color: "#6B7280" },
  { key: "community", title: "Community", sub: "Farmer groups, discussions", icon: "people", screen: "Community", color: "#8B5CF6" },
];

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const { user } = useAuth();
  const isOnline = health.data?.status === "ok";
  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
        <Text style={styles.statusText}>{isOnline ? "Online" : "Offline — cached data"}</Text>
        <Pressable style={styles.profilePill} onPress={() => nav.navigate("Profile")}>
          <Text style={styles.profileInitials}>{initials}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <Text style={styles.greeting}>Namaste{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 🙏</Text>
        <Text style={styles.greetingSub}>What would you like to explore today?</Text>

        {/* Quick voice CTA */}
        <Pressable style={styles.voiceCta} onPress={() => nav.navigate("Ask")}>
          <View style={styles.voiceCtaIcon}>
            <Ionicons name="mic" size={22} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.voiceCtaTitle}>Ask anything by voice</Text>
            <Text style={styles.voiceCtaSub}>Tap to speak in Hindi or English</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        {/* Quick Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Market Prices" value="Live" icon="trending-up" tint={colors.success} />
          <StatCard label="Courses" value="3 Active" icon="book" tint={colors.warn} />
          <StatCard label="Schemes" value="2 New" icon="flag" tint={colors.primary} />
        </View>

        {/* Module cards */}
        <Text style={styles.sectionTitle}>Explore Modules</Text>
        {MODULES.map((m) => (
          <Pressable
            key={m.key}
            style={styles.moduleCard}
            onPress={() => {
              if (m.key === "community") nav.navigate("Community");
              else nav.navigate(m.screen);
            }}
          >
            <View style={[styles.moduleIconWrap, { backgroundColor: m.color + "18" }]}>
              <Ionicons name={m.icon as any} size={22} color={m.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.moduleTitle}>{m.title}</Text>
              <Text style={styles.moduleSub}>{m.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </Pressable>
        ))}

        {/* Eligibility shortcut */}
        <Pressable style={styles.eligibilityCta} onPress={() => nav.navigate("Eligibility")}>
          <Ionicons name="shield-checkmark" size={20} color="#FFF" />
          <Text style={styles.eligibilityText}>Check Loan Eligibility</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Stat mini-card ── */
function StatCard({ label, value, icon, tint }: { label: string; value: string; icon: string; tint: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tint + "18" }]}>
        <Ionicons name={icon as any} size={16} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  statusBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 6, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.muted },
  profilePill: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  profileInitials: { fontSize: 11, fontWeight: "900", color: colors.primary },
  content: { padding: 20, paddingBottom: 100 },
  greeting: { fontSize: 22, fontWeight: "900", color: colors.ink },
  greetingSub: { marginTop: 4, fontSize: 13, fontWeight: "500", color: colors.muted },
  voiceCta: { marginTop: 20, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.primaryTint, shadowColor: colors.primary, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  voiceCtaIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  voiceCtaTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  voiceCtaSub: { fontSize: 11, fontWeight: "500", color: colors.muted, marginTop: 2 },
  statsRow: { marginTop: 20, flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 13, fontWeight: "900", color: colors.ink },
  statLabel: { fontSize: 10, fontWeight: "600", color: colors.muted },
  sectionTitle: { marginTop: 24, marginBottom: 12, fontSize: 15, fontWeight: "900", color: colors.ink },
  moduleCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  moduleIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  moduleTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  moduleSub: { fontSize: 11, fontWeight: "500", color: colors.muted, marginTop: 2 },
  eligibilityCta: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  eligibilityText: { fontSize: 14, fontWeight: "900", color: "#FFF" },
});

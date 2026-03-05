/**
 * Sync Status Screen — offline/bandwidth status, category filters,
 * per-domain sync items, cached KB size, sync badges.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useHealthCheck } from "../hooks/useData";

const CATEGORIES = ["All", "Agriculture", "Economics", "Health", "Knowledge"];

const SYNC_ITEMS = [
  { id: "agri", domain: "Agriculture", icon: "leaf", items: "Market prices, crop data", kb: 14, synced: true, ago: "2 min" },
  { id: "econ", domain: "Economics", icon: "business", items: "Savings, schemes", kb: 8, synced: true, ago: "5 min" },
  { id: "health", domain: "Health", icon: "heart-circle", items: "Symptom data, providers", kb: 22, synced: false, ago: "Pending" },
  { id: "knowledge", domain: "Knowledge", icon: "bulb", items: "Courses, credentials", kb: 18, synced: true, ago: "10 min" },
  { id: "weather", domain: "Weather", icon: "cloud", items: "7-day forecast, alerts", kb: 6, synced: true, ago: "1 min" },
];

export default function SyncStatusScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const isOnline = health.data?.status === "ok";
  const [filter, setFilter] = useState("All");

  const filtered = filter === "All" ? SYNC_ITEMS : SYNC_ITEMS.filter((s) => s.domain === filter);
  const totalKb = SYNC_ITEMS.reduce((s, i) => s + i.kb, 0);
  const syncedCount = SYNC_ITEMS.filter((s) => s.synced).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Offline & Sync</Text>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Network status card */}
        <View style={[styles.netCard, { backgroundColor: isOnline ? "#ECFDF5" : "#FEF2F2", borderColor: isOnline ? "#BBF7D0" : "#FECACA" }]}>
          <Ionicons name={isOnline ? "wifi" : "cloud-offline"} size={22} color={isOnline ? colors.success : colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.netTitle, { color: isOnline ? "#166534" : "#991B1B" }]}>
              {isOnline ? "Connected — syncing data" : "Offline mode — using cached data"}
            </Text>
            <Text style={styles.netSub}>{totalKb}kB cached • {syncedCount}/{SYNC_ITEMS.length} synced • 2G compressed</Text>
          </View>
        </View>

        {/* Category filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} style={[styles.pill, filter === c && styles.pillActive]} onPress={() => setFilter(c)}>
              <Text style={[styles.pillText, filter === c && styles.pillTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Sync items */}
        {filtered.map((item) => (
          <View key={item.id} style={styles.syncCard}>
            <View style={styles.syncRow}>
              <View style={[styles.syncIcon, { backgroundColor: item.synced ? colors.successTint : colors.warnTint }]}>
                <Ionicons name={item.icon as any} size={18} color={item.synced ? colors.success : colors.warn} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.syncDomain}>{item.domain}</Text>
                <Text style={styles.syncItems}>{item.items}</Text>
              </View>
              <View style={[styles.syncBadge, { backgroundColor: item.synced ? colors.successTint : colors.warnTint }]}>
                <Ionicons name={item.synced ? "checkmark-circle" : "time"} size={11} color={item.synced ? colors.success : colors.warn} />
                <Text style={[styles.syncBadgeText, { color: item.synced ? colors.success : colors.warn }]}>
                  {item.synced ? "Synced" : "Pending"}
                </Text>
              </View>
            </View>
            <View style={styles.syncMeta}>
              <Text style={styles.syncKb}>{item.kb}kB cached</Text>
              <Text style={styles.syncAgo}>{item.ago} ago</Text>
            </View>
          </View>
        ))}

        {/* Sync Now CTA */}
        <Pressable style={[styles.cta, !isOnline && { opacity: 0.5 }]} disabled={!isOnline}>
          <Ionicons name="sync" size={20} color="#FFF" />
          <Text style={styles.ctaText}>Sync Now</Text>
        </Pressable>

        {/* Storage info */}
        <View style={styles.storageRow}>
          <Ionicons name="server" size={14} color={colors.muted} />
          <Text style={styles.storageText}>Total cache: {totalKb}kB • Last full sync: 25 min ago</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  content: { padding: 16, paddingBottom: 100 },
  netCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  netTitle: { fontSize: 13, fontWeight: "800" },
  netSub: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 3 },
  pillScroll: { marginBottom: 14, flexGrow: 0 },
  pillRow: { gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 11, fontWeight: "800", color: colors.muted },
  pillTextActive: { color: "#FFF" },
  syncCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, gap: 8 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  syncIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  syncDomain: { fontSize: 13, fontWeight: "900", color: colors.ink },
  syncItems: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 2 },
  syncBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  syncBadgeText: { fontSize: 10, fontWeight: "800" },
  syncMeta: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 48 },
  syncKb: { fontSize: 10, fontWeight: "700", color: colors.muted },
  syncAgo: { fontSize: 10, fontWeight: "700", color: colors.muted },
  cta: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
  storageRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  storageText: { fontSize: 10, fontWeight: "600", color: colors.muted },
});

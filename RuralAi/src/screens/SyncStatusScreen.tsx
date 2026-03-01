/**
 * Sync Status Screen — offline & low bandwidth status, per-module sync stats.
 * Matches reference: module list with cached/compressed sizes, Sync Now button.
 */

import React from "react";
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

const SYNC_MODULES = [
  { name: "Agriculture", icon: "leaf-outline", cached: "14KB", compressed: "2G", color: colors.primary },
  { name: "Health", icon: "medkit-outline", cached: "14KB", compressed: "2G", color: colors.success },
  { name: "Learning", icon: "book-outline", cached: "14KB", compressed: "2G", color: colors.warn },
  { name: "Infrastructure", icon: "business-outline", cached: "14KB", compressed: "2G", color: colors.muted },
];

type Filter = "Agriculture" | "Economics" | "Health";
const FILTERS: Filter[] = ["Agriculture", "Economics", "Health"];

export default function SyncStatusScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const [activeFilter, setActiveFilter] = React.useState<Filter>("Agriculture");

  return (
    <SafeAreaView style={styles.safe}>
      {/* Status */}
      <View style={styles.statusBar}>
        <Ionicons name="cloud-offline-outline" size={14} color={colors.muted} />
        <Text style={styles.statusLabel}>Property 5</Text>
      </View>

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Rural Ecosystem Platform</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Offline and low bandwidth{"\n"}status screen</Text>

        <Text style={styles.sectionTitle}>Sync statistics</Text>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[styles.filterPill, activeFilter === f && styles.filterActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        {/* Module list */}
        {SYNC_MODULES.map((m) => (
          <View key={m.name} style={styles.moduleRow}>
            <View style={[styles.moduleIcon, { backgroundColor: `${m.color}15` }]}>
              <Ionicons name={m.icon as any} size={18} color={m.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.moduleName}>{m.name}</Text>
              <Text style={styles.moduleDetail}>{m.cached} cached, {m.compressed} compressed</Text>
            </View>
            <View style={styles.syncedBadge}>
              <Text style={styles.syncedText}>Synced</Text>
            </View>
          </View>
        ))}

        {/* Sync Now */}
        <Pressable style={styles.syncBtn}>
          <Ionicons name="sync" size={18} color="#FFF" />
          <Text style={styles.syncBtnText}>Sync Now</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  statusBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 6, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },

  content: { paddingHorizontal: 20, paddingTop: 12 },

  title: { fontSize: 17, fontWeight: "900", color: colors.ink, textAlign: "center", lineHeight: 24 },
  sectionTitle: { marginTop: 20, fontSize: 14, fontWeight: "800", color: colors.ink, textAlign: "center" },

  filterRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 14 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 11, fontWeight: "800", color: colors.ink },
  filterTextActive: { color: "#FFF" },

  moduleRow: {
    flexDirection: "row", alignItems: "center", marginTop: 12,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: colors.border, padding: 12,
  },
  moduleIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  moduleName: { fontSize: 13, fontWeight: "800", color: colors.ink },
  moduleDetail: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 2 },
  syncedBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.successTint,
  },
  syncedText: { fontSize: 10, fontWeight: "900", color: colors.success },

  syncBtn: {
    marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.primary,
  },
  syncBtnText: { fontSize: 14, fontWeight: "900", color: "#FFF", letterSpacing: 0.5 },
});

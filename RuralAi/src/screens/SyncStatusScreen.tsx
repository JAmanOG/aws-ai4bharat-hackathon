/**
 * Sync Status Screen — renders actual voice pipeline health reported by the backend.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useHealthCheck, usePipelineHealth } from "../hooks/useData";
import {
  buildPipelineCategories,
  buildPipelineStatusItems,
  countAvailableComponents,
  countDegradedComponents,
} from "../features/sync/pipelineHealth";

export default function SyncStatusScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const pipeline = usePipelineHealth();
  const isOnline = health.data?.status === "ok";
  const [filter, setFilter] = useState("All");

  const pipelineData = pipeline.data as any;
  const items = useMemo(() => buildPipelineStatusItems(pipelineData), [pipelineData]);
  const categories = useMemo(() => buildPipelineCategories(items), [items]);
  const filtered = filter === "All" ? items : items.filter((item) => item.category === filter);
  const availableCount = countAvailableComponents(items);
  const degradedCount = countDegradedComponents(items);
  const agentCount = Array.isArray(pipelineData?.agents) ? pipelineData.agents.length : 0;
  const pipelineDescription = String(pipelineData?.pipeline ?? "").trim();
  const pipelineHealthy = pipelineData?.healthy === true;

  useEffect(() => {
    if (!categories.includes(filter)) {
      setFilter("All");
    }
  }, [categories, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Offline & Sync</Text>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.netCard,
            {
              backgroundColor: isOnline ? "#ECFDF5" : "#FEF2F2",
              borderColor: isOnline ? "#BBF7D0" : "#FECACA",
            },
          ]}
        >
          <Ionicons
            name={isOnline ? "wifi" : "cloud-offline"}
            size={22}
            color={isOnline ? colors.success : colors.danger}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.netTitle, { color: isOnline ? "#166534" : "#991B1B" }]}>
              {isOnline ? "Backend reachable" : "Backend unreachable"}
            </Text>
            <Text style={styles.netSub}>
              {items.length > 0
                ? `${availableCount}/${items.length} components available • ${agentCount} agents registered`
                : pipeline.loading
                  ? "Checking pipeline health…"
                  : "No pipeline health data reported yet"}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillRow}>
          {categories.map((category) => (
            <Pressable
              key={category}
              style={[styles.pill, filter === category && styles.pillActive]}
              onPress={() => setFilter(category)}
            >
              <Text style={[styles.pillText, filter === category && styles.pillTextActive]}>{category}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {pipeline.loading && items.length === 0 ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateTitle}>Checking pipeline status</Text>
            <Text style={styles.stateText}>Fetching real component health from the backend.</Text>
          </View>
        ) : null}

        {!pipeline.loading && pipeline.error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={30} color={colors.danger} />
            <Text style={styles.stateTitle}>Could not load sync status</Text>
            <Text style={styles.stateText}>The backend did not return pipeline health. Retry once the server is reachable.</Text>
          </View>
        ) : null}

        {!pipeline.loading && !pipeline.error && items.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="server-outline" size={30} color={colors.warn} />
            <Text style={styles.stateTitle}>No pipeline data reported</Text>
            <Text style={styles.stateText}>This screen only shows live component status returned by the backend.</Text>
          </View>
        ) : null}

        {filtered.map((item) => {
          const appearance = getStatusAppearance(item.status);
          return (
            <View key={item.id} style={styles.syncCard}>
              <View style={styles.syncRow}>
                <View style={[styles.syncIcon, { backgroundColor: appearance.tint }]}>
                  <Ionicons name={getCategoryIcon(item.category)} size={18} color={appearance.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syncDomain}>{item.label}</Text>
                  <Text style={styles.syncItems}>{item.category} • {item.detail}</Text>
                </View>
                <View style={[styles.syncBadge, { backgroundColor: appearance.tint }]}>
                  <Ionicons name={appearance.icon} size={11} color={appearance.color} />
                  <Text style={[styles.syncBadgeText, { color: appearance.color }]}>{item.statusLabel}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <Pressable style={styles.cta} onPress={pipeline.refresh}>
          <Ionicons name="sync" size={20} color="#FFF" />
          <Text style={styles.ctaText}>Refresh Status</Text>
        </Pressable>

        <View style={styles.storageRow}>
          <Ionicons name="server" size={14} color={colors.muted} />
          <Text style={styles.storageText}>
            {pipelineDescription
              ? `${pipelineDescription} • ${pipelineHealthy ? "Healthy" : `${degradedCount} degraded`}`
              : `Agents registered: ${agentCount}`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getCategoryIcon(category: string) {
  if (category === "Voice Input") return "mic";
  if (category === "AI Routing") return "git-network";
  if (category === "Voice Output") return "volume-high";
  if (category === "Storage") return "server";
  return "construct";
}

function getStatusAppearance(status: string) {
  if (status === "available") {
    return { color: colors.success, tint: colors.successTint, icon: "checkmark-circle" as const };
  }
  if (status === "missing_key") {
    return { color: colors.warn, tint: colors.warnTint, icon: "key-outline" as const };
  }
  return { color: colors.danger, tint: colors.dangerTint, icon: "alert-circle" as const };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  content: { padding: 16, paddingBottom: 100 },
  netCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  netTitle: { fontSize: 13, fontWeight: "800" },
  netSub: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 3 },
  pillScroll: { marginBottom: 14, flexGrow: 0 },
  pillRow: { gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 11, fontWeight: "800", color: colors.muted },
  pillTextActive: { color: "#FFF" },
  stateCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stateTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "900",
    color: colors.ink,
    textAlign: "center",
  },
  stateText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 17,
    color: colors.muted,
    textAlign: "center",
  },
  syncCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  syncIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  syncDomain: { fontSize: 13, fontWeight: "900", color: colors.ink },
  syncItems: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 2 },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  syncBadgeText: { fontSize: 10, fontWeight: "800" },
  cta: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
  storageRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  storageText: { flex: 1, fontSize: 10, fontWeight: "600", color: colors.muted, textAlign: "center" },
});

/**
 * Agriculture / Market Dashboard — matches reference mockup.
 * Map header, Buyer stats, Crop tiles, Price mini-charts, "Collect to Bargain".
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
import { useMarketPrices, useMandis, useHealthCheck } from "../hooks/useData";
import { LoadingView, ErrorView } from "../components/ui";

export default function AgriMarketScreen() {
  const nav = useNavigation<any>();
  const wheat = useMarketPrices("wheat");
  const rice = useMarketPrices("rice");
  const mandis = useMandis();
  const health = useHealthCheck();
  const synced = !health.error;

  const wheatPrices = (wheat.data as any)?.prices ?? [];
  const ricePrices = (rice.data as any)?.prices ?? [];
  const mandiList = (mandis.data as any)?.mandis ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Ionicons name={synced ? "wifi" : "cloud-offline-outline"} size={14} color={synced ? colors.primary : colors.muted} />
        <Text style={styles.statusLabel}>{synced ? "Online" : "Offline"}</Text>
        <View style={styles.divider} />
        <Text style={styles.statusLabel}>{synced ? "Data synced" : "Sync pending"}</Text>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Agriculture/Market</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map placeholder */}
        <View style={styles.mapBox}>
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={40} color={colors.muted} />
            <Text style={styles.mapText}>Mandi Map</Text>
          </View>
          {/* Dots overlay */}
          {[
            { top: "20%", left: "30%" },
            { top: "40%", left: "55%" },
            { top: "25%", left: "70%" },
            { top: "60%", left: "40%" },
            { top: "50%", left: "65%" },
            { top: "35%", left: "45%" },
          ].map((pos, i) => (
            <View key={i} style={[styles.mapDot, { top: pos.top as any, left: pos.left as any, backgroundColor: i % 3 === 0 ? colors.danger : colors.success }]} />
          ))}
        </View>

        {/* Buyer stat pills */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <View style={[styles.pillDot, { backgroundColor: colors.success }]} />
            <Text style={styles.pillText}>Verified Buyers</Text>
            <Text style={styles.pillBold}>{mandiList.length > 0 ? `${mandiList.length} mandis` : "—"}</Text>
          </View>
          <View style={styles.pill}>
            <View style={[styles.pillDot, { backgroundColor: colors.danger }]} />
            <Text style={styles.pillText}>Market Data</Text>
            <Text style={styles.pillBold}>{wheatPrices.length + ricePrices.length > 0 ? `${wheatPrices.length + ricePrices.length} records` : "—"}</Text>
          </View>
        </View>

        {/* Info tiles row */}
        <View style={styles.tilesRow}>
          <View style={styles.infoTile}>
            <Ionicons name="leaf" size={18} color={colors.success} />
            <Text style={styles.infoLabel}>Crops</Text>
            <Text style={styles.infoValue}>{wheat.data ? "Wheat, Rice" : "Loading…"}</Text>
          </View>
          <View style={[styles.infoTile, { borderColor: colors.dangerTint }]}>
            <Ionicons name="time-outline" size={18} color={colors.danger} />
            <Text style={styles.infoLabel}>Historical</Text>
            <Text style={styles.infoValue}>{wheatPrices.length > 0 ? `${wheatPrices.length} records` : "—"}</Text>
          </View>
        </View>

        {/* Price mini-cards */}
        <View style={styles.priceRow}>
          <PriceCard
            label="Wheat"
            value={wheat.data?.summary?.average_price}
            loading={wheat.loading}
            trend="up"
            prices={wheatPrices}
          />
          <PriceCard
            label="Rice"
            value={rice.data?.summary?.average_price}
            loading={rice.loading}
            trend="down"
            prices={ricePrices}
          />
        </View>

        {/* Collect to Bargain CTA */}
        <Pressable style={styles.bargainBtn} onPress={() => nav.navigate("MarketPrices")}>
          <View style={styles.bargainIcon}>
            <Ionicons name="people" size={20} color="#FFF" />
          </View>
          <Text style={styles.bargainText}>Collect to Bargain</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Price Card ── */

function PriceCard({ label, value, loading, trend, prices }: { label: string; value: number | undefined; loading: boolean; trend: "up" | "down"; prices: any[] }) {
  const trendColor = trend === "up" ? colors.success : colors.danger;
  /* Build sparkline from real price data or show flat line */
  const sparkData = React.useMemo(() => {
    if (prices.length >= 3) {
      const vals = prices.slice(-7).map((p: any) => p.modal_price ?? p.price ?? 0);
      const max = Math.max(...vals, 1);
      return vals.map((v: number) => v / max);
    }
    return [0.3, 0.3, 0.3, 0.3, 0.3]; // flat line when no data
  }, [prices]);

  return (
    <View style={styles.priceCard}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>{loading ? "…" : value != null ? `₹${value}` : "N/A"}</Text>
      {/* Mini sparkline */}
      <View style={styles.sparkline}>
        {sparkData.map((h: number, i: number) => (
          <View key={i} style={[styles.sparkBar, { height: h * 28, backgroundColor: trendColor }]} />
        ))}
      </View>
      <Text style={[styles.trendLabel, { color: trendColor }]}>
        {trend === "up" ? "↑ Rising" : "↓ Falling"}
      </Text>
    </View>
  );
}

/* ────────────── Styles ────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  statusBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 6, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },
  divider: { width: 1, height: 12, backgroundColor: colors.border, marginHorizontal: 4 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "900", color: colors.ink },

  content: { paddingHorizontal: 16, paddingTop: 8 },

  /* Map */
  mapBox: {
    height: 160, borderRadius: 16, backgroundColor: "#EDF2F7",
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  mapPlaceholder: { alignItems: "center", gap: 4 },
  mapText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  mapDot: { position: "absolute", width: 10, height: 10, borderRadius: 5 },

  /* Pills */
  pillRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  pill: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    flexWrap: "wrap",
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 10, fontWeight: "700", color: colors.muted },
  pillBold: { fontSize: 10, fontWeight: "900", color: colors.ink },

  /* Info tiles */
  tilesRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  infoTile: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", gap: 4,
  },
  infoLabel: { fontSize: 11, fontWeight: "800", color: colors.ink },
  infoValue: { fontSize: 10, fontWeight: "600", color: colors.muted },

  /* Price cards */
  priceRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  priceCard: {
    flex: 1, padding: 12, borderRadius: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center",
  },
  priceLabel: { fontSize: 11, fontWeight: "800", color: colors.ink },
  priceValue: { fontSize: 20, fontWeight: "900", color: colors.ink, marginTop: 2 },
  sparkline: { flexDirection: "row", gap: 2, alignItems: "flex-end", marginTop: 8, height: 28 },
  sparkBar: { width: 6, borderRadius: 3 },
  trendLabel: { marginTop: 4, fontSize: 10, fontWeight: "800" },

  /* CTA */
  bargainBtn: {
    marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.primary,
  },
  bargainIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center",
  },
  bargainText: { fontSize: 14, fontWeight: "900", color: "#FFF", letterSpacing: 0.4 },
});

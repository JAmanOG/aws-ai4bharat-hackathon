/**
 * AgriMarket Screen — mockup: map, buyer badges, crop tiles, price sparklines,
 * collective bargaining CTA.
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
import { useMarketPrices, useMandis, useHealthCheck } from "../hooks/useData";

const { width: SCREEN_W } = Dimensions.get("window");

/* ── Mini sparkline (pure RN) ── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  return (
    <View style={sparkStyles.wrap}>
      {data.map((v, i) => {
        const h = 6 + ((v - min) / range) * 20;
        return <View key={i} style={[sparkStyles.bar, { height: h, backgroundColor: color }]} />;
      })}
    </View>
  );
}
const sparkStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 30 },
  bar: { width: 4, borderRadius: 2 },
});

/* ── Buyer dot for map placeholder ── */
function BuyerDot({ left, top, verified }: { left: number; top: number; verified?: boolean }) {
  return (
    <View style={[dotStyles.wrap, { left: `${left}%` as any, top: `${top}%` as any }]}>
      <View style={[dotStyles.dot, verified && dotStyles.verified]} />
      {verified && <View style={dotStyles.checkBg}><Ionicons name="checkmark" size={7} color="#FFF" /></View>}
    </View>
  );
}
const dotStyles = StyleSheet.create({
  wrap: { position: "absolute" },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, borderWidth: 2, borderColor: "#FFF" },
  verified: { backgroundColor: colors.success },
  checkBg: { position: "absolute", top: -4, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
});

export default function AgriMarketScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const wheat = useMarketPrices("wheat");
  const rice = useMarketPrices("rice");
  const mandis = useMandis();
  const isOnline = health.data?.status === "ok";

  const wheatPrice = wheat.data?.summary?.average_price ?? 2245;
  const ricePrice = rice.data?.summary?.average_price ?? 1890;
  const mandiCount = mandis.data?.mandis?.length ?? 5;
  const wheatTrend: number[] = [2100, 2150, 2200, 2180, 2245, 2260, 2245];
  const riceTrend: number[] = [1820, 1850, 1870, 1860, 1890, 1880, 1890];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Agriculture & Market</Text>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map area */}
        <View style={styles.mapCard}>
          <View style={styles.mapPlaceholder}>
            <BuyerDot left={20} top={30} verified />
            <BuyerDot left={55} top={20} />
            <BuyerDot left={40} top={55} verified />
            <BuyerDot left={70} top={45} />
            <BuyerDot left={30} top={70} />
            <BuyerDot left={60} top={65} verified />
            <View style={styles.mapOverlay}>
              <Text style={styles.mapLabel}>Mandis Nearby</Text>
            </View>
          </View>
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Verified Buyer</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>High Volume</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendCount}>{mandiCount} mandis</Text>
            </View>
          </View>
        </View>

        {/* Crop info tiles */}
        <View style={styles.tileRow}>
          <View style={styles.infoTile}>
            <Ionicons name="leaf" size={18} color={colors.success} />
            <Text style={styles.tileValue}>Crops</Text>
            <Text style={styles.tileSub}>{wheatPrice > 0 ? "Wheat, Rice" : "Loading..."}</Text>
          </View>
          <View style={styles.infoTile}>
            <Ionicons name="time" size={18} color={colors.warn} />
            <Text style={styles.tileValue}>Historical</Text>
            <Text style={styles.tileSub}>7-day trend</Text>
          </View>
        </View>

        {/* Price cards */}
        <Text style={styles.sectionTitle}>Live Mandi Prices</Text>

        <View style={styles.priceCard}>
          <View style={styles.priceHeader}>
            <View style={[styles.cropBadge, { backgroundColor: "#FEF3C7" }]}>
              <Text style={styles.cropEmoji}>🌾</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cropName}>Wheat</Text>
              <Text style={styles.cropSub}>Rabi • Current Season</Text>
            </View>
            <View style={styles.priceCol}>
              <Text style={styles.priceVal}>₹{wheatPrice}/q</Text>
              <Text style={[styles.priceDelta, { color: colors.success }]}>+2.1%</Text>
            </View>
          </View>
          <Sparkline data={wheatTrend} color={colors.success} />
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceHeader}>
            <View style={[styles.cropBadge, { backgroundColor: "#ECFDF5" }]}>
              <Text style={styles.cropEmoji}>🌾</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cropName}>Rice</Text>
              <Text style={styles.cropSub}>Kharif • Last Season</Text>
            </View>
            <View style={styles.priceCol}>
              <Text style={styles.priceVal}>₹{ricePrice}/q</Text>
              <Text style={[styles.priceDelta, { color: colors.warn }]}>+0.5%</Text>
            </View>
          </View>
          <Sparkline data={riceTrend} color={colors.warn} />
        </View>

        {/* CTA */}
        <Pressable style={styles.cta} onPress={() => nav.navigate("AgriMarket")}>
          <Ionicons name="people" size={20} color="#FFF" />
          <Text style={styles.ctaText}>Collect to Bargain</Text>
        </Pressable>
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
  mapCard: { backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  mapPlaceholder: { height: 170, backgroundColor: "#E8F5E9", position: "relative" },
  mapOverlay: { position: "absolute", bottom: 10, left: 10, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  mapLabel: { fontSize: 11, fontWeight: "800", color: colors.ink },
  legend: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: "700", color: colors.muted },
  legendCount: { fontSize: 10, fontWeight: "800", color: colors.primary },
  tileRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  infoTile: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border },
  tileValue: { fontSize: 13, fontWeight: "900", color: colors.ink },
  tileSub: { fontSize: 10, fontWeight: "600", color: colors.muted },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: colors.ink, marginBottom: 10 },
  priceCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, gap: 10 },
  priceHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cropBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cropEmoji: { fontSize: 20 },
  cropName: { fontSize: 14, fontWeight: "800", color: colors.ink },
  cropSub: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 2 },
  priceCol: { alignItems: "flex-end" },
  priceVal: { fontSize: 15, fontWeight: "900", color: colors.ink },
  priceDelta: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  cta: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.success, borderRadius: 14, paddingVertical: 16, shadowColor: colors.success, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
});

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useMarketPrices } from "../hooks/useData";
import { LoadingView, ErrorView, SyncPill } from "../components/ui";

export default function MarketPricesScreen() {
  const nav = useNavigation<any>();

  const [searchText, setSearchText] = useState("Wheat");
  const [crop, setCrop] = useState("Wheat");
  const [mandi, setMandi] = useState("All mandis");

  // Debounced search — user types, hits Enter / blurs to search
  const handleSearch = useCallback(() => {
    const trimmed = searchText.trim();
    if (trimmed && trimmed !== crop) setCrop(trimmed);
  }, [searchText, crop]);

  const { data, loading, error, refresh } = useMarketPrices(crop);

  const avgPrice = data?.summary?.average_price ?? 0;
  const lastUpdated = data?.last_updated
    ? new Date(data.last_updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Market Prices</Text>
          <SyncPill synced={!error} />
        </View>

        {loading && !data ? (
          <LoadingView message={`Fetching ${crop} prices…`} />
        ) : error && !data ? (
          <ErrorView message={error.message} onRetry={refresh} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Search Row */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={colors.muted} />
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  onSubmitEditing={handleSearch}
                  onBlur={handleSearch}
                  placeholder="Search crop (e.g., Wheat, Rice)"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  returnKeyType="search"
                />
              </View>

              <Pressable style={styles.locBtn} onPress={() => {
                Alert.alert("Select Mandi", "Choose a location", [
                  { text: "All mandis", onPress: () => setMandi("All mandis") },
                  { text: "Nearest mandi", onPress: () => setMandi("Nearest") },
                  { text: "Cancel", style: "cancel" },
                ]);
              }}>
                <Ionicons name="location-outline" size={18} color={colors.earth} />
                <Text style={styles.locText} numberOfLines={1}>{mandi}</Text>
              </Pressable>
            </View>

            {/* Current Price Card */}
            <View style={styles.priceCard}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.cardLabel}>Average price</Text>
                {lastUpdated ? (
                  <View style={styles.smallChip}>
                    <Ionicons name="time-outline" size={12} color={colors.muted} />
                    <Text style={styles.smallChipText}>Updated {lastUpdated}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.price}>₹ {Math.round(avgPrice)}</Text>
              <Text style={styles.priceSub}>
                per quintal • {data?.crop ?? crop} • {data?.summary?.mandi_count ?? 0} mandis
              </Text>

              {/* Trend summary */}
              <View style={styles.trendBox}>
                <TrendLine
                  icon="stats-chart-outline"
                  text={`Min: ₹${data?.summary?.min_price ?? '–'} • Max: ₹${data?.summary?.max_price ?? '–'}`}
                />
                <TrendLine icon="alert-circle-outline" text="Tip: Set price alert for big changes" />
              </View>
            </View>

            {/* Compare markets */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Compare markets</Text>
              <Pressable style={styles.filterBtn} onPress={refresh}>
                <Ionicons name="refresh-outline" size={16} color={colors.earth} />
                <Text style={styles.filterText}>Refresh</Text>
              </Pressable>
            </View>

            <View style={{ gap: 10 }}>
              {(data?.prices ?? []).map((p, idx) => (
                <View key={`${p.mandi_name}-${idx}`} style={styles.marketRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.marketName}>{p.mandi_name}</Text>
                    <Text style={styles.marketMeta}>
                      {p.district ? `${p.district}, ${p.state}` : p.state}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.marketPrice}>₹ {p.price_per_quintal}</Text>
                    <ChangePill change={p.change ?? "same"} />
                  </View>
                </View>
              ))}
            </View>

            {/* CTA buttons */}
            <View style={styles.ctaRow}>
              <Pressable style={styles.alertBtn} onPress={() => nav.navigate("Alerts")}>
                <Ionicons name="notifications-outline" size={18} color={colors.ink} />
                <Text style={styles.alertText}>Set price alert</Text>
              </Pressable>

              <Pressable style={styles.refreshBtn} onPress={refresh}>
                <Ionicons name="refresh-outline" size={18} color={colors.earth} />
                <Text style={styles.refreshText}>Refresh</Text>
              </Pressable>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function TrendLine({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 }}>
        {text}
      </Text>
    </View>
  );
}

function ChangePill({ change }: { change: "up" | "down" | "same" }) {
  const label = change === "up" ? "UP" : change === "down" ? "DOWN" : "SAME";
  const bg =
    change === "up"
      ? "rgba(19,236,91,0.18)"
      : change === "down"
      ? "rgba(185,28,28,0.10)"
      : "rgba(107,114,128,0.10)";
  const border =
    change === "up"
      ? "rgba(19,236,91,0.28)"
      : change === "down"
      ? "rgba(185,28,28,0.18)"
      : "rgba(107,114,128,0.18)";
  const color =
    change === "up" ? colors.ink : change === "down" ? "#B91C1C" : colors.muted;

  return (
    <View style={[styles.changePill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.changeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },

  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(19,236,91,0.14)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncText: { fontSize: 11, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },

  offlineBanner: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  offlineTitle: { fontSize: 12, fontWeight: "900", color: colors.ink },
  offlineSub: { marginTop: 2, fontSize: 11, color: colors.muted, fontWeight: "700" },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  retryText: { fontSize: 12, fontWeight: "900", color: colors.ink },

  content: { paddingTop: 12, paddingBottom: 18 },

  searchRow: { flexDirection: "row", gap: 10 },
  searchBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, fontSize: 12, fontWeight: "800", color: colors.ink },

  locBtn: {
    width: 130,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locText: { flex: 1, fontSize: 11, fontWeight: "900", color: colors.earth },

  priceCard: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  cardLabel: { fontSize: 12, fontWeight: "900", color: colors.ink },
  smallChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallChipText: { fontSize: 10, fontWeight: "900", color: colors.muted },

  price: { marginTop: 10, fontSize: 28, fontWeight: "900", color: colors.ink },
  priceSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: colors.muted },

  trendBox: {
    marginTop: 12,
    backgroundColor: "rgba(19,236,91,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.18)",
    padding: 12,
    gap: 8,
  },

  sectionHeader: {
    marginTop: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: colors.ink },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.18)",
  },
  filterText: { fontSize: 11, fontWeight: "900", color: colors.earth },

  marketRow: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  marketName: { fontSize: 13, fontWeight: "900", color: colors.ink },
  marketMeta: { marginTop: 3, fontSize: 11, fontWeight: "700", color: colors.muted },
  marketPrice: { fontSize: 13, fontWeight: "900", color: colors.ink },

  changePill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  changeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },

  ctaRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  alertBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
  },
  alertText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.ink },

  refreshBtn: {
    width: 130,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
  },
  refreshText: { fontSize: 11, fontWeight: "900", color: colors.earth },
});
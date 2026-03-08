import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useMarketPrices } from "../hooks/useData";
import { LoadingView, ErrorView, SyncPill } from "../components/ui";
import type { HomeStackParamList } from "../navigation/HomeStack";
import {
  formatMarketCropLabel,
  normalizeMarketCropName,
  normalizeMarketStateName,
} from "../utils/market";
import { useScreenContext } from "../context/ScreenContext";

export default function MarketPricesScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<HomeStackParamList, "MarketPrices">>();
  const screen = useScreenContext();
  const routeCrop = normalizeMarketCropName(route.params?.crop);
  const routeState = normalizeMarketStateName(route.params?.location);

  const [searchText, setSearchText] = useState(formatMarketCropLabel(routeCrop));
  const [crop, setCrop] = useState(routeCrop);
  const [stateFilter, setStateFilter] = useState<string | undefined>(routeState);
  const [mandi, setMandi] = useState(routeState ?? "All mandis");

  useEffect(() => {
    const normalizedCrop = normalizeMarketCropName(route.params?.crop);
    const normalizedState = normalizeMarketStateName(route.params?.location);
    setCrop(normalizedCrop);
    setSearchText(formatMarketCropLabel(normalizedCrop));
    setStateFilter(normalizedState);
    setMandi(normalizedState ?? "All mandis");
  }, [route.params?.crop, route.params?.location]);

  // Debounced search — user types, hits Enter / blurs to search
  const handleSearch = useCallback(() => {
    const trimmed = searchText.trim();
    if (!trimmed) return;
    const normalizedCrop = normalizeMarketCropName(trimmed, crop);
    setCrop(normalizedCrop);
    setSearchText(formatMarketCropLabel(normalizedCrop));
  }, [searchText, crop]);

  const { data, loading, error, refresh } = useMarketPrices(crop, stateFilter);
  const fallbackQuery = useMarketPrices(stateFilter ? crop : "");
  const showFallbackRows =
    !!stateFilter &&
    !loading &&
    (data?.prices?.length ?? 0) === 0 &&
    (fallbackQuery.data?.prices?.length ?? 0) > 0;
  const effectiveData = showFallbackRows ? fallbackQuery.data : data;
  const visibleDates = useMemo(
    () => Array.from(new Set((effectiveData?.prices ?? []).map((price) => price.date).filter(Boolean))).sort(),
    [effectiveData?.prices]
  );
  const visibleDatePreview = useMemo(() => {
    if (visibleDates.length === 0) return "None";
    if (visibleDates.length <= 4) return visibleDates.join(", ");
    return `${visibleDates.slice(0, 2).join(", ")} ... ${visibleDates.slice(-2).join(", ")}`;
  }, [visibleDates]);

  const avgPrice = effectiveData?.summary?.average_price ?? 0;
  const lastUpdated = effectiveData?.last_updated
    ? new Date(effectiveData.last_updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  useEffect(() => {
    screen.update({
      screen: "MarketPrices",
      crop,
      location: stateFilter || undefined,
      meta: {
        locationFilter: stateFilter || "All India",
        visibleScope: showFallbackRows && stateFilter ? `Fallback to All India for ${stateFilter}` : (stateFilter || "All India"),
        visibleRows: effectiveData?.prices?.length ?? 0,
        visiblePriceDateStart: visibleDates[0] || "None",
        visiblePriceDateEnd: visibleDates[visibleDates.length - 1] || "None",
        visiblePriceDates: visibleDatePreview,
        visibleMandis: (effectiveData?.prices ?? []).slice(0, 5).map((price) => price.mandi_name).join(", ") || "None",
      },
    });
  }, [crop, effectiveData?.prices, screen.update, showFallbackRows, stateFilter, visibleDatePreview, visibleDates]);

  const formatVisibleDate = useCallback((date?: string) => {
    if (!date) return "";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Market Prices</Text>
          <SyncPill synced={!error} />
        </View>

        {(loading || (stateFilter && !data && fallbackQuery.loading)) && !effectiveData ? (
          <LoadingView message={`Fetching ${crop} prices…`} />
        ) : error && !effectiveData ? (
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
                  {
                    text: "All mandis",
                    onPress: () => {
                      setMandi("All mandis");
                      setStateFilter(undefined);
                    },
                  },
                  {
                    text: "Nearest mandi",
                    onPress: () => {
                      setMandi("Nearest");
                      setStateFilter(undefined);
                    },
                  },
                  { text: "Cancel", style: "cancel" },
                ]);
              }}>
                <Ionicons name="location-outline" size={18} color={colors.earth} />
                <Text style={styles.locText} numberOfLines={1}>{mandi}</Text>
              </Pressable>
            </View>

            {/* Current Price Card */}
            <View style={styles.priceCard}>
              {showFallbackRows ? (
                <View style={styles.fallbackBanner}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.earth} />
                  <Text style={styles.fallbackText}>
                    No live rows for {stateFilter}. Showing latest {formatMarketCropLabel(crop)} prices from other states.
                  </Text>
                </View>
              ) : null}
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
                per quintal • {formatMarketCropLabel(effectiveData?.crop ?? crop)}{showFallbackRows ? " • All India fallback" : stateFilter ? ` • ${stateFilter}` : ""} • {effectiveData?.summary?.mandi_count ?? 0} mandis
              </Text>
              {visibleDates.length > 0 ? (
                <Text style={styles.priceCoverage}>
                  Visible dates: {formatVisibleDate(visibleDates[0])}
                  {visibleDates.length > 1 ? ` to ${formatVisibleDate(visibleDates[visibleDates.length - 1])}` : ""}
                </Text>
              ) : null}

              {/* Trend summary */}
              <View style={styles.trendBox}>
                <TrendLine
                  icon="stats-chart-outline"
                  text={`Min: ₹${effectiveData?.summary?.min_price ?? '–'} • Max: ₹${effectiveData?.summary?.max_price ?? '–'}`}
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
              {(effectiveData?.prices?.length ?? 0) > 0 ? (
                (effectiveData?.prices ?? []).map((p, idx) => (
                  <View key={`${p.mandi_name}-${idx}`} style={styles.marketRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.marketName}>{p.mandi_name}</Text>
                      <Text style={styles.marketMeta}>
                        {[p.district ? `${p.district}, ${p.state}` : p.state, formatVisibleDate(p.date)].filter(Boolean).join(" • ")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.marketPrice}>₹ {Math.round(p.price_per_quintal)}</Text>
                      <ChangePill change={p.change ?? "same"} />
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="analytics-outline" size={20} color={colors.earth} />
                  <Text style={styles.emptyTitle}>No market rows available</Text>
                  <Text style={styles.emptyText}>
                    {data?.message ?? `No live mandi prices were returned for ${formatMarketCropLabel(crop)}${stateFilter ? ` in ${stateFilter}` : ""}.`}
                  </Text>
                </View>
              )}
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
  fallbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.18)",
  },
  fallbackText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "800", color: colors.earth },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  emptyText: { fontSize: 12, lineHeight: 18, textAlign: "center", color: colors.muted, fontWeight: "700" },

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
  priceCoverage: { marginTop: 6, fontSize: 11, fontWeight: "700", color: colors.earth },

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

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSchemes } from "../hooks/useData";
import { ruralPalette as P } from "../theme/ruralPalette";
import { useDemoScreenActions } from "../demo/DemoActions";

const FILTERS = [
  { key: "All", label: "All support", icon: "apps-outline" as const },
  { key: "loan", label: "Loans", icon: "cash-outline" as const },
  { key: "insurance", label: "Insurance", icon: "shield-checkmark-outline" as const },
  { key: "subsidy", label: "Subsidies", icon: "wallet-outline" as const },
] as const;

function getTypeAccent(type?: string) {
  switch ((type ?? "").toLowerCase()) {
    case "loan":
      return { bg: P.economics, ink: P.economicsIcon, icon: "cash-outline" as const };
    case "insurance":
      return { bg: P.health, ink: P.healthIcon, icon: "shield-checkmark-outline" as const };
    case "subsidy":
      return { bg: P.goldSoft, ink: P.goldDark, icon: "wallet-outline" as const };
    default:
      return { bg: P.surfaceSoft, ink: P.mutedDark, icon: "document-text-outline" as const };
  }
}

export default function SchemesListScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const moduleTitle = route?.params?.moduleTitle ?? "FINANCE";

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("All");

  const typeParam = filter === "All" ? undefined : filter;
  const { data, loading, error, refresh } = useSchemes(typeParam);

  const demoActions = useMemo(
    () => ({
      setFilter: (payload?: Record<string, any>) => {
        const nextFilter = typeof payload?.filter === "string" ? payload.filter : "All";
        const supportedFilter = FILTERS.find((item) => item.key === nextFilter)?.key ?? "All";
        setFilter(supportedFilter);
        setQ(typeof payload?.query === "string" ? payload.query : "");
      },
      clearSearch: () => setQ(""),
    }),
    [],
  );

  useDemoScreenActions("SchemesList", demoActions);

  const filtered = useMemo(() => {
    if (!data?.schemes) return [];
    const text = q.trim().toLowerCase();
    if (!text) return data.schemes;
    return data.schemes.filter(
      (scheme) =>
        scheme.name.toLowerCase().includes(text) ||
        (scheme.summary ?? "").toLowerCase().includes(text) ||
        (scheme.benefit_summary ?? "").toLowerCase().includes(text) ||
        (scheme.provider ?? "").toLowerCase().includes(text)
    );
  }, [data, q]);

  const totalSchemes = data?.schemes?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={28} color={P.ink} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Government Schemes</Text>
          <Text style={styles.sub}>{moduleTitle} support, eligibility, and apply steps</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{error ? "Offline" : "Live"}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.iconTile}>
              <Ionicons name="document-text-outline" size={20} color={P.goldDark} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>Browse support that matches the current flow</Text>
              <Text style={styles.summaryText}>
                Search verified government schemes, compare benefits, and open the official next step.
              </Text>
            </View>
          </View>
          <View style={styles.summaryMetaRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{filtered.length}</Text>
              <Text style={styles.metricLabel}>visible</Text>
            </View>
            <View style={styles.metricPillMuted}>
              <Text style={styles.metricMutedText}>
                {filter === "All" ? "All categories" : `${filter[0].toUpperCase()}${filter.slice(1)} focus`}
              </Text>
            </View>
            {totalSchemes > 0 ? (
              <Text style={styles.summaryFootnote}>{totalSchemes} total schemes available</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={P.mutedDark} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search PM-Kisan, PMFBY, KCC..."
            placeholderTextColor={P.muted}
            style={styles.input}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
              >
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={active ? P.ink : P.mutedDark}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading && !data ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={P.goldDark} />
            <Text style={styles.stateTitle}>Loading scheme directory</Text>
            <Text style={styles.stateText}>Fetching the latest support programs and official details.</Text>
          </View>
        ) : error && !data ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={28} color={P.mutedDark} />
            <Text style={styles.stateTitle}>Could not load schemes</Text>
            <Text style={styles.stateText}>{error.message}</Text>
            <Pressable style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryText}>Retry</Text>
              <Ionicons name="refresh" size={16} color={P.ink} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.listStack}>
            {filtered.map((scheme: any) => {
              const accent = getTypeAccent(scheme.type);
              return (
                <Pressable
                  key={scheme.id}
                  style={styles.card}
                  onPress={() => nav.navigate("SchemeDetail", { schemeId: scheme.id })}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: accent.bg }]}>
                      <Ionicons name={accent.icon} size={18} color={accent.ink} />
                    </View>
                    <View style={styles.cardHeaderCopy}>
                      <Text style={styles.cardTitle}>{scheme.name}</Text>
                      <Text style={styles.cardMeta}>
                        {scheme.provider || "Government"}{scheme.type ? ` • ${scheme.type}` : ""}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={P.mutedDark} />
                  </View>

                  {scheme.benefit_summary ? (
                    <Text style={styles.benefitText}>{scheme.benefit_summary}</Text>
                  ) : null}
                  {scheme.summary ? (
                    <Text style={styles.cardSub} numberOfLines={2}>
                      {scheme.summary}
                    </Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <View style={[styles.typePill, { backgroundColor: accent.bg }]}>
                      <Text style={[styles.typeText, { color: accent.ink }]}>
                        {(scheme.type || "scheme").toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.verifiedPill}>
                      <Ionicons name="checkmark-circle" size={14} color={P.healthIcon} />
                      <Text style={styles.verifiedText}>
                        {scheme.verified === false ? "Check latest" : "Verified"}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {filtered.length === 0 && (
              <View style={styles.stateCard}>
                <Ionicons name="search-outline" size={26} color={P.mutedDark} />
                <Text style={styles.stateTitle}>No schemes found</Text>
                <Text style={styles.stateText}>Try a broader search or switch the current filter.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: P.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: P.bgWarm,
    borderBottomWidth: 1,
    borderBottomColor: P.lineSoft,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    color: P.ink,
  },
  sub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: P.mutedDark,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#FFF1C9",
    borderWidth: 1,
    borderColor: "#E8D59F",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: P.goldDark,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "900",
    color: P.ink,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 160,
    gap: 16,
  },
  summaryCard: {
    borderRadius: 30,
    padding: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    shadowColor: P.goldShadow,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2D9A4",
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: P.ink,
  },
  summaryText: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: P.mutedDark,
  },
  summaryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#FFF1C9",
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "900",
    color: P.ink,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: P.mutedDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricPillMuted: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#F9F4E8",
    borderWidth: 1,
    borderColor: P.lineSoft,
  },
  metricMutedText: {
    fontSize: 12,
    fontWeight: "800",
    color: P.mutedDark,
  },
  summaryFootnote: {
    fontSize: 12,
    fontWeight: "700",
    color: P.goldDark,
  },
  searchBox: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: P.ink,
  },
  chipsRow: {
    gap: 10,
    paddingRight: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: "#EFD27A",
    borderColor: "#DFC16D",
  },
  chipInactive: {
    backgroundColor: P.surface,
    borderColor: P.line,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
    color: P.mutedDark,
  },
  chipTextActive: {
    color: P.ink,
  },
  listStack: {
    gap: 14,
  },
  card: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: "#E2D0A4",
    shadowColor: P.goldShadow,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderCopy: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: P.ink,
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: P.mutedDark,
  },
  benefitText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: P.goldDark,
  },
  cardSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: P.mutedDark,
  },
  cardFooter: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#EDF5E4",
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "900",
    color: P.ink,
  },
  stateCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    alignItems: "center",
    gap: 8,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  stateText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: P.mutedDark,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "#EFD27A",
  },
  retryText: {
    fontSize: 13,
    fontWeight: "900",
    color: P.ink,
  },
});

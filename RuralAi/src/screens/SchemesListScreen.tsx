import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useSchemes } from "../hooks/useData";
import { LoadingView, ErrorView, SyncPill } from "../components/ui";

const FILTERS = ["All", "loan", "insurance", "subsidy"] as const;

export default function SchemesListScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const moduleTitle = route?.params?.moduleTitle ?? "FINANCE";

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("All");

  const typeParam = filter === "All" ? undefined : filter;
  const { data, loading, error, refresh } = useSchemes(typeParam);

  const filtered = useMemo(() => {
    if (!data?.schemes) return [];
    const text = q.trim().toLowerCase();
    if (!text) return data.schemes;
    return data.schemes.filter(
      (s) =>
        s.name.toLowerCase().includes(text) ||
        s.summary?.toLowerCase().includes(text)
    );
  }, [data, q]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Govt Schemes</Text>
            <Text style={styles.sub}>{moduleTitle} • Eligibility & Steps</Text>
          </View>
          <SyncPill synced={!error} />
        </View>

        {loading && !data ? (
          <LoadingView message="Loading schemes…" />
        ) : error && !data ? (
          <ErrorView message={error.message} onRetry={refresh} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search schemes (KCC, PMFBY...)"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 14 }}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.chip, filter === f ? styles.chipActive : styles.chipInactive]}
                >
                  <Text style={[styles.chipText, filter === f ? { color: colors.ink } : { color: colors.earth }]}>
                    {f.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* List */}
            <View style={{ marginTop: 12, gap: 10 }}>
              {filtered.map((s: any) => (
                <Pressable
                  key={s.id}
                  style={styles.card}
                  onPress={() => nav.navigate("SchemeDetail", { schemeId: s.id })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{s.name}</Text>
                    <View style={styles.verifiedPill}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  </View>
                  <Text style={styles.cardMeta}>{s.type} • {s.provider}</Text>
                  <Text style={styles.cardSub} numberOfLines={2}>{s.benefit_summary ?? s.summary}</Text>
                  <View style={styles.cardFooter}>
                    <View style={styles.stepsPill}>
                      <Ionicons name="list-outline" size={14} color={colors.earth} />
                      <Text style={styles.stepsText}>View details</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </View>
                </Pressable>
              ))}

              {filtered.length === 0 && (
                <View style={styles.empty}>
                  <Ionicons name="search-outline" size={22} color={colors.muted} />
                  <Text style={styles.emptyText}>No schemes found</Text>
                  <Text style={styles.emptySub}>Try a different keyword or filter.</Text>
                </View>
              )}
            </View>
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },
  sub: { marginTop: 2, fontSize: 11, fontWeight: "700", color: colors.muted },

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

  content: { paddingTop: 12, paddingBottom: 18, gap: 12 },

  searchBox: {
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

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: "rgba(19,236,91,0.18)", borderColor: "rgba(19,236,91,0.28)" },
  chipInactive: { backgroundColor: "rgba(139,94,60,0.10)", borderColor: "rgba(139,94,60,0.20)" },
  chipText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  cardTitle: { fontSize: 13, fontWeight: "900", color: colors.ink, flex: 1 },
  cardMeta: { fontSize: 11, fontWeight: "800", color: colors.earth },
  cardSub: { fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(19,236,91,0.12)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.22)",
  },
  verifiedText: { fontSize: 10, fontWeight: "900", color: colors.ink },

  cardFooter: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(139,94,60,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.16)",
  },
  stepsText: { fontSize: 11, fontWeight: "900", color: colors.earth },

  empty: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  emptyText: { fontSize: 13, fontWeight: "900", color: colors.ink },
  emptySub: { fontSize: 11, fontWeight: "700", color: colors.muted, textAlign: "center" },
});
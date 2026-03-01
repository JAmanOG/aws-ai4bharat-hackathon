import React, { useMemo, useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { governmentApi } from "../api/community";

type Scheme = {
  id: string;
  title: string;
  category: "Farmer" | "Loan" | "Subsidy" | "Insurance" | "Health";
  benefit: string;
  eligibility: string;
  verified?: boolean;
};

const SCHEMES: Scheme[] = [
  { id: "pmkisan", title: "PM-Kisan Samman Nidhi", category: "Farmer", benefit: "₹6,000/year", eligibility: "Small & marginal farmers", verified: true },
  { id: "kcc", title: "Kisan Credit Card (KCC)", category: "Loan", benefit: "Low-interest credit", eligibility: "Farmers with land records", verified: true },
  { id: "pmsby", title: "PMSBY Accident Insurance", category: "Insurance", benefit: "₹2 lakh cover", eligibility: "Bank account holders", verified: true },
  { id: "pmjay", title: "PM-JAY (Ayushman Bharat)", category: "Health", benefit: "₹5 lakh cover", eligibility: "Eligible families", verified: true },
  { id: "subsidy-irrig", title: "Irrigation Subsidy", category: "Subsidy", benefit: "Partial subsidy", eligibility: "Depends on state scheme" },
];

const FILTERS: Array<Scheme["category"] | "All"> = ["All", "Farmer", "Loan", "Subsidy", "Insurance", "Health"];

export default function SchemesListScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const moduleTitle = route?.params?.moduleTitle ?? "SCHEMES";

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [loading, setLoading] = useState(false);
  const [schemes, setSchemes] = useState<Scheme[]>(SCHEMES); // Start with hardcoded

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await governmentApi.listSchemes({ limit: 20 } as any);
      if (res.data?.schemes?.length) {
        const remote = res.data.schemes.map((s: any) => ({
          id: s.id,
          title: s.name || s.title,
          category: s.category || "Govt",
          benefit: s.budget_allocated || "Govt backed",
          eligibility: s.eligibility_criteria || s.description || "See details",
          verified: true,
        }));
        setSchemes(remote);
      }
    } catch (err) {
      console.log("Schemes failed, using fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchemes();
  }, [fetchSchemes]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return schemes.filter((s) => {
      const matchText = !text || s.title.toLowerCase().includes(text);
      const matchFilter = filter === "All" || s.category === filter;
      return matchText && matchFilter;
    });
  }, [q, filter, schemes]);

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

          <View style={styles.syncPill}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>SYNCED</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Search */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search schemes (PM-Kisan, KCC...)"
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
            {filtered.map((s) => (
              <Pressable
                key={s.id}
                style={styles.card}
                onPress={() => nav.navigate("SchemeDetail", { schemeId: s.id })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{s.title}</Text>

                  {s.verified ? (
                    <View style={styles.verifiedPill}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.cardMeta}>{s.category} • {s.benefit}</Text>
                <Text style={styles.cardSub} numberOfLines={2}>{s.eligibility}</Text>

                <View style={styles.cardFooter}>
                  <View style={styles.stepsPill}>
                    <Ionicons name="list-outline" size={14} color={colors.earth} />
                    <Text style={styles.stepsText}>View steps</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </View>
              </Pressable>
            ))}

            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={22} color={colors.muted} />
                <Text style={styles.emptyText}>No schemes found</Text>
                <Text style={styles.emptySub}>Try a different keyword or filter.</Text>
              </View>
            ) : null}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
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
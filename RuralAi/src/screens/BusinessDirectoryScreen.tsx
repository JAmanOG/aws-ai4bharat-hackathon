import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useBusinessCategories, useBusinessListings } from "../hooks/useData";
import { LoadingView, ErrorView, EmptyView, SyncPill } from "../components/ui";

export default function BusinessDirectoryScreen() {
  const nav = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | undefined>(undefined);

  const categories = useBusinessCategories();
  const listings = useBusinessListings({ search: search || undefined, categoryId: selectedCat, limit: 20 });

  const loading = categories.loading || listings.loading;
  const error = categories.error || listings.error;

  const catList = useMemo(() => {
    if (!Array.isArray(categories.data)) return [];
    return categories.data;
  }, [categories.data]);

  const businessList = useMemo(() => {
    const raw = (listings.data as any)?.businesses;
    return Array.isArray(raw) ? raw : [];
  }, [listings.data]);

  if (loading && !categories.data) return <LoadingView message="Loading businesses…" />;
  if (error && !categories.data) return <ErrorView message={error.message} onRetry={categories.refresh} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Business Directory</Text>
            <Text style={styles.sub}>Local businesses near you</Text>
          </View>
          <SyncPill synced={!error} />
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search businesses…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 14, marginBottom: 10 }}
        >
          <Pressable
            onPress={() => setSelectedCat(undefined)}
            style={[styles.chip, !selectedCat ? styles.chipActive : styles.chipInactive]}
          >
            <Text style={[styles.chipText, !selectedCat ? { color: "#FFF" } : { color: colors.earth }]}>All</Text>
          </Pressable>
          {catList.map((c: any) => (
            <Pressable
              key={c.id}
              onPress={() => setSelectedCat(selectedCat === c.id ? undefined : c.id)}
              style={[styles.chip, selectedCat === c.id ? styles.chipActive : styles.chipInactive]}
            >
              <Text style={{ marginRight: 4 }}>{c.icon}</Text>
              <Text style={[styles.chipText, selectedCat === c.id ? { color: "#FFF" } : { color: colors.earth }]}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Listings */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {listings.loading && (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
          {!listings.loading && businessList.length === 0 && (
            <EmptyView icon="storefront-outline" title="No businesses found" subtitle="Try a different search or category" />
          )}
          {businessList.map((b: any) => (
            <View key={b.id} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{b.name}</Text>
                {b.is_verified && (
                  <View style={styles.verifiedPill}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              {b.category_name && <Text style={styles.cardMeta}>{b.category_name}</Text>}
              <Text style={styles.cardSub} numberOfLines={2}>{b.address}</Text>
              {b.phone && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                  <Ionicons name="call-outline" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>{b.phone}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  header: { paddingHorizontal: 14, paddingTop: 6, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },
  sub: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 2 },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12,
    paddingHorizontal: 12, marginHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14, color: colors.ink },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipActive: { backgroundColor: colors.primary },
  chipInactive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 12, fontWeight: "700" },
  content: { paddingHorizontal: 14, paddingBottom: 24, gap: 10 },
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, flex: 1 },
  cardMeta: { fontSize: 12, color: colors.earth, fontWeight: "600", marginTop: 4 },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  verifiedPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.successTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  verifiedText: { fontSize: 10, fontWeight: "700", color: colors.success },
});

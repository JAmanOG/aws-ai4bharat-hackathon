import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useGovtPortals, useGovtComplaints } from "../hooks/useData";
import { governmentApi } from "../services/api";
import { LoadingView, ErrorView, EmptyView, SyncPill } from "../components/ui";

const CATEGORIES = ["all", "infrastructure", "roads", "water", "electricity", "sanitation", "general"];

export default function GovtPortalsScreen() {
  const nav = useNavigation<any>();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const portals = useGovtPortals({
    category: category === "all" ? undefined : category,
    search: search || undefined,
  });

  const portalList = useMemo(() => {
    const raw = (portals.data as any)?.portals;
    return Array.isArray(raw) ? raw : [];
  }, [portals.data]);

  if (portals.loading && !portals.data) return <LoadingView message="Loading portals…" />;
  if (portals.error && !portals.data) return <ErrorView message={portals.error.message} onRetry={portals.refresh} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Government Portals</Text>
            <Text style={styles.sub}>Schemes, Services & Complaints</Text>
          </View>
          <SyncPill synced={!portals.error} />
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search portals…"
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
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, category === c ? styles.chipActive : styles.chipInactive]}
            >
              <Text style={[styles.chipText, category === c ? { color: "#FFF" } : { color: colors.earth }]}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Portal list */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {portalList.length === 0 && !portals.loading && (
            <EmptyView icon="globe-outline" title="No portals found" subtitle="Try a different category" />
          )}
          {portalList.map((p: any) => (
            <Pressable
              key={p.id}
              style={styles.card}
              onPress={() => {
                if (p.url) {
                  Linking.openURL(p.url).catch(() =>
                    Alert.alert("Cannot Open", "Could not open the portal URL."),
                  );
                }
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{p.name}</Text>
                <View style={[styles.catPill, { backgroundColor: colors.primaryTint }]}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary }}>
                    {(p.category || "general").toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub} numberOfLines={2}>{p.description}</Text>
              {p.region && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                  <Ionicons name="location-outline" size={14} color={colors.earth} />
                  <Text style={{ fontSize: 12, color: colors.earth, fontWeight: "600" }}>{p.region}</Text>
                </View>
              )}
              {p.url && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Ionicons name="open-outline" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }} numberOfLines={1}>
                    {p.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}

          {/* Quick links */}
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Pressable
              style={styles.actionCard}
              onPress={() => nav.navigate("SchemesList", { moduleTitle: "GOVERNMENT" })}
            >
              <Ionicons name="document-text-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Browse Schemes</Text>
                <Text style={styles.actionSub}>View all government schemes with eligibility details</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
            <Pressable
              style={styles.actionCard}
              onPress={() => nav.navigate("Eligibility")}
            >
              <Ionicons name="checkmark-done-outline" size={22} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Check Eligibility</Text>
                <Text style={styles.actionSub}>Find schemes you qualify for</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </View>
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
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipActive: { backgroundColor: colors.primary },
  chipInactive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 12, fontWeight: "700" },
  content: { paddingHorizontal: 14, paddingBottom: 24, gap: 10 },
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, flex: 1 },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 18 },
  catPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 10 },
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  actionTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  actionSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});

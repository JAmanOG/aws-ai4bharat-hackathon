import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useLivelihoodCategories, useLivelihoodGuidance } from "../hooks/useData";
import { EmptyView } from "../components/ui";

export default function LivelihoodScreen() {
  const nav = useNavigation<any>();
  const [selectedCat, setSelectedCat] = useState<string | undefined>(undefined);

  const categories = useLivelihoodCategories();
  const guidance = useLivelihoodGuidance({ categoryId: selectedCat });

  const catList = useMemo(() => {
    const raw = (categories.data as any)?.categories ?? categories.data;
    return Array.isArray(raw) ? raw : [];
  }, [categories.data]);

  const guideList = useMemo(() => {
    const raw = (guidance.data as any)?.guidance ?? guidance.data;
    return Array.isArray(raw) ? raw : [];
  }, [guidance.data]);

  const ICONS: Record<string, string> = {
    agriculture: "leaf-outline",
    dairy: "nutrition-outline",
    handicraft: "color-palette-outline",
    fishery: "fish-outline",
    services: "briefcase-outline",
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Livelihood</Text>
            <Text style={styles.sub}>Guidance & opportunities</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Category chips */}
          <Text style={styles.sectionTitle}>Categories</Text>
          {categories.loading && <ActivityIndicator color={colors.primary} />}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
          >
            <Pressable
              onPress={() => setSelectedCat(undefined)}
              style={[
                styles.chip,
                selectedCat === undefined ? styles.chipActive : styles.chipInactive,
              ]}
            >
              <Ionicons
                name="apps-outline"
                size={14}
                color={selectedCat === undefined ? "#FFF" : colors.earth}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: selectedCat === undefined ? "#FFF" : colors.earth },
                ]}
              >
                All
              </Text>
            </Pressable>
            {catList.map((c: any) => {
              const active = selectedCat === c.id;
              const icon = ICONS[c.slug || c.name?.toLowerCase()] || "ellipse-outline";
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCat(active ? undefined : c.id)}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                >
                  <Ionicons name={icon as any} size={14} color={active ? "#FFF" : colors.earth} />
                  <Text style={[styles.chipText, { color: active ? "#FFF" : colors.earth }]}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Guidance cards */}
          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Guidance</Text>
          {guidance.loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />}
          {!guidance.loading && guideList.length === 0 && (
            <EmptyView
              icon="book-outline"
              title="No guidance found"
              subtitle={selectedCat ? "Try selecting a different category" : "Guidance will appear here"}
            />
          )}
          {guideList.map((g: any) => (
            <View key={g.id} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.primaryTint },
                  ]}
                >
                  <Ionicons name="bulb-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{g.title}</Text>
                  {g.category_name && (
                    <Text style={styles.catLabel}>{g.category_name}</Text>
                  )}
                </View>
              </View>
              <Text style={styles.cardBody} numberOfLines={4}>
                {g.content}
              </Text>
              {g.region && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                  <Ionicons name="location-outline" size={14} color={colors.earth} />
                  <Text style={{ fontSize: 12, color: colors.earth }}>{g.region}</Text>
                </View>
              )}
              {g.external_url && (
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => {
                    const { Linking } = require("react-native");
                    Linking.openURL(g.external_url).catch(() => {});
                  }}
                >
                  <Ionicons name="open-outline" size={13} color={colors.primary} />
                  <Text style={styles.linkText}>Learn more</Text>
                </Pressable>
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
  header: {
    paddingHorizontal: 14, paddingTop: 6, flexDirection: "row", alignItems: "center",
    gap: 10, marginBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },
  sub: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 2 },
  content: { paddingHorizontal: 14, paddingBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  chipActive: { backgroundColor: colors.primary },
  chipInactive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  catLabel: { fontSize: 11, fontWeight: "600", color: colors.primary, marginTop: 2 },
  cardBody: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 8 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
  },
  linkBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10,
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.primaryTint,
    borderRadius: 8, alignSelf: "flex-start",
  },
  linkText: { fontSize: 12, fontWeight: "700", color: colors.primary },
});

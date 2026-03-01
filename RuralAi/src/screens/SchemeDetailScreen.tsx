import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useSchemeDetail } from "../hooks/useData";
import { LoadingView, ErrorView } from "../components/ui";

export default function SchemeDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const schemeId = (route?.params?.schemeId ?? "") as string;

  const { data: detail, loading, error, refresh } = useSchemeDetail(schemeId);
  const [saved, setSaved] = useState(false);

  if (loading) return <LoadingView message="Loading scheme…" />;
  if (error) return <ErrorView message={error.message} onRetry={refresh} />;
  if (!detail) return <ErrorView message="Scheme not found" onRetry={() => nav.goBack()} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>Scheme Detail</Text>
          <Pressable style={styles.saveBtn} onPress={() => setSaved((v) => !v)}>
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={colors.earth} />
            <Text style={styles.saveText}>{saved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main card */}
          <View style={styles.card}>
            <Text style={styles.schemeTitle}>{detail.name}</Text>
            <Text style={styles.benefit}>{detail.benefit_summary}</Text>
            <Text style={styles.eligibility}>{detail.summary}</Text>
            {detail.provider ? (
              <Text style={styles.provider}>Provider: {detail.provider}</Text>
            ) : null}
            {detail.type ? (
              <View style={styles.typePill}>
                <Text style={styles.typeText}>{detail.type.toUpperCase()}</Text>
              </View>
            ) : null}

            {saved ? (
              <View style={styles.savedPill}>
                <Ionicons name="cloud-done-outline" size={14} color={colors.primary} />
                <Text style={styles.savedText}>Available offline</Text>
              </View>
            ) : null}
          </View>

          {/* Docs checklist */}
          <Text style={styles.section}>What you need</Text>
          <View style={styles.card}>
            {(detail.documents_required ?? []).map((d: string, idx: number) => (
              <View key={idx} style={styles.checkRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.checkText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Recommended for */}
          {detail.recommended_for?.length > 0 && (
            <>
              <Text style={styles.section}>Recommended for</Text>
              <View style={styles.card}>
                {detail.recommended_for.map((r: string, idx: number) => (
                  <View key={idx} style={styles.checkRow}>
                    <Ionicons name="star-outline" size={16} color={colors.earth} />
                    <Text style={styles.checkText}>{r}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* CTA */}
          <Pressable style={styles.primaryBtn}>
            <Ionicons name="open-outline" size={18} color={colors.ink} />
            <Text style={styles.primaryText}>Open Apply Portal</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn}>
            <Ionicons name="call-outline" size={18} color={colors.earth} />
            <Text style={styles.secondaryText}>Call Helpline</Text>
          </Pressable>

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
  title: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
  },
  saveText: { fontSize: 11, fontWeight: "900", color: colors.earth },

  content: { paddingTop: 12, paddingBottom: 18, gap: 12 },

  section: { marginTop: 6, fontSize: 18, fontWeight: "900", color: colors.ink },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  schemeTitle: { fontSize: 14, fontWeight: "900", color: colors.ink },
  benefit: { fontSize: 12, fontWeight: "900", color: colors.earth },
  eligibility: { fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 },
  provider: { fontSize: 11, fontWeight: "700", color: colors.muted, marginTop: 4 },
  typePill: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
  },
  typeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7, color: colors.earth },

  savedPill: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(19,236,91,0.12)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.22)",
  },
  savedText: { fontSize: 10, fontWeight: "900", color: colors.ink },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkText: { flex: 1, fontSize: 12, fontWeight: "800", color: colors.ink },

  stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(19,236,91,0.14)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  numText: { fontSize: 11, fontWeight: "900", color: colors.ink },
  stepText: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  primaryBtn: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
  },
  primaryText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.ink },

  secondaryBtn: {
    backgroundColor: "rgba(139,94,60,0.10)",
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
  },
  secondaryText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.earth },
});
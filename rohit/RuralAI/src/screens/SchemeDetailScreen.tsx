import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { governmentApi } from "../api/community";

type SchemeDetail = {
  id: string;
  title: string;
  benefit: string;
  eligibility: string;
  docs: string[];
  steps: string[];
  url?: string;
};



export default function SchemeDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const schemeId = (route?.params?.schemeId ?? "pmkisan") as string;

  const [detail, setDetail] = useState<SchemeDetail | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    (async () => {
      console.log(`[CRUD:READ] Fetching scheme details for ${schemeId}`);
      try {
        const res = await governmentApi.getScheme(schemeId);
        if (res.data) {
          console.log(`[CRUD:READ] Successfully fetched details for ${schemeId}`);
          const s = res.data;
          setDetail({
            id: s.id,
            title: s.name || s.title || "",
            benefit: s.budget_allocated || s.benefit || "",
            eligibility: s.eligibility_criteria || s.description || "",
            docs: s.required_docs || [],
            steps: s.application_steps || [],
            url: s.application_url || undefined,
          });
          setIsLive(true);
        } else {
          console.log(`[CRUD:READ] No details found for ${schemeId}`);
        }
      } catch (err) {
        console.log(`[CRUD:READ] Error fetching details for ${schemeId}`, err);
      }
      setLoading(false);
    })();
  }, [schemeId]);

  const handleOpenPortal = () => {
    console.log(`[ACTION] User trying to open portal for scheme ${schemeId}`);
    if (detail?.url) {
      console.log(`[ACTION] Opening URL: ${detail.url}`);
      Linking.openURL(detail.url).catch(() => Alert.alert("Error", "Could not open link"));
    } else {
      console.log(`[ACTION] No URL found for scheme ${schemeId}`);
      Alert.alert("Info", "No portal URL available for this scheme.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => { console.log(`[NAV] Navigating back from SchemeDetailScreen (${schemeId})`); nav.goBack(); }}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>

          <Text style={styles.title} numberOfLines={1}>Scheme Detail</Text>

          <Pressable style={styles.saveBtn} onPress={() => { console.log(`[ACTION] Toggled save status for scheme ${schemeId}. Was: ${saved}`); setSaved(v => !v); }}>
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={colors.earth} />
            <Text style={styles.saveText}>{saved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={{ alignItems: "center", paddingTop: 16 }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {detail ? (
            <>
              {/* Main card */}
              <View style={styles.card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Text style={styles.schemeTitle}>{detail.title}</Text>
                  {isLive && (
                    <View style={styles.liveDot}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                    </View>
                  )}
                </View>
                <Text style={styles.benefit}>{detail.benefit}</Text>
                <Text style={styles.eligibility}>{detail.eligibility}</Text>

                {saved ? (
                  <View style={styles.savedPill}>
                    <Ionicons name="cloud-done-outline" size={14} color={colors.primary} />
                    <Text style={styles.savedText}>Available offline</Text>
                  </View>
                ) : null}
              </View>

              {/* Docs checklist */}
              {detail.docs && detail.docs.length > 0 && (
                <>
                  <Text style={styles.section}>What you need</Text>
                  <View style={styles.card}>
                    {detail.docs.map((d, idx) => (
                      <View key={idx} style={styles.checkRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={styles.checkText}>{d}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Steps */}
              {detail.steps && detail.steps.length > 0 && (
                <>
                  <Text style={styles.section}>Steps</Text>
                  <View style={styles.card}>
                    {detail.steps.map((s, idx) => (
                      <View key={idx} style={styles.stepRow}>
                        <View style={styles.num}>
                          <Text style={styles.numText}>{idx + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text>No scheme details available.</Text>
            </View>
          )}

          {/* CTA */}
          <Pressable style={styles.primaryBtn} onPress={handleOpenPortal}>
            <Ionicons name="open-outline" size={18} color={colors.ink} />
            <Text style={styles.primaryText}>Open Apply Portal</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={() => { console.log(`[ACTION] Calling scheme helpline for ${schemeId}`); Linking.openURL("tel:1800111555"); }}>
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
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.22)" },
  saveText: { fontSize: 11, fontWeight: "900", color: colors.earth },
  content: { paddingTop: 12, paddingBottom: 18, gap: 12 },
  section: { marginTop: 6, fontSize: 18, fontWeight: "900", color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  schemeTitle: { fontSize: 14, fontWeight: "900", color: colors.ink },
  benefit: { fontSize: 12, fontWeight: "900", color: colors.earth },
  eligibility: { fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 },
  liveDot: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(19,236,91,0.14)" },
  savedPill: { marginTop: 6, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(19,236,91,0.12)", borderWidth: 1, borderColor: "rgba(19,236,91,0.22)" },
  savedText: { fontSize: 10, fontWeight: "900", color: colors.ink },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkText: { flex: 1, fontSize: 12, fontWeight: "800", color: colors.ink },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(19,236,91,0.14)", borderWidth: 1, borderColor: "rgba(19,236,91,0.22)", alignItems: "center", justifyContent: "center", marginTop: 1 },
  numText: { fontSize: 11, fontWeight: "900", color: colors.ink },
  stepText: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.muted, lineHeight: 16 },
  primaryBtn: { marginTop: 6, backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 14, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(19,236,91,0.35)" },
  primaryText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.ink },
  secondaryBtn: { backgroundColor: "rgba(139,94,60,0.10)", borderRadius: 18, paddingVertical: 14, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(139,94,60,0.22)" },
  secondaryText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.earth },
});
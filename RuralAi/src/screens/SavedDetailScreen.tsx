import React, { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { chatWithText } from "../services/voice";

const DATA: Record<string, { title: string; body: string; tags: string[] }> = {
  "1": { title: "PM-Kisan Application Steps", body: "1) Aadhaar + land records ready\n2) Apply via portal/CSC\n3) Verify details\n4) Track status", tags: ["Scheme", "Offline"] },
  "2": { title: "Wheat price in nearby mandi", body: "Mandi A: ₹2320\nMandi B: ₹2280\nTip: set price alert for changes.", tags: ["Market"] },
  "3": { title: "Fever + cough guidance", body: "Home care: rest + hydration\nMonitor temperature\nIf breathing issue or severe symptoms → consult doctor.", tags: ["Health"] },
  "4": { title: "Offline basics: crop calendar", body: "Plan sowing, irrigation, fertiliser schedule.\nSave reminders for key dates.", tags: ["Agriculture", "Offline"] },
};

export default function SavedDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const itemId = (route?.params?.itemId ?? "1") as string;

  const item = useMemo(() => DATA[itemId] ?? DATA["1"], [itemId]);
  const [saved, setSaved] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const handleReadAloud = useCallback(async () => {
    if (speaking) return;
    setSpeaking(true);
    try {
      const res = await chatWithText(
        `Please read this aloud clearly in simple language: ${item.title}. ${item.body}`,
        { language: "en" }
      );
      if (res.audio_base64) {
        /* Audio was returned — in a full implementation this plays via expo-audio.
           For now, show a brief confirmation that TTS was generated. */
        Alert.alert("Read Aloud", "Audio generated. Playback will use the voice overlay.");
      } else {
        Alert.alert("Read Aloud", item.body.substring(0, 200));
      }
    } catch {
      Alert.alert("Error", "Could not read aloud. Please try again.");
    } finally {
      setSpeaking(false);
    }
  }, [item, speaking]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.hTitle} numberOfLines={1}>Saved Detail</Text>
          <Pressable style={styles.saveBtn} onPress={() => setSaved((v) => !v)}>
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={colors.earth} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>

            <View style={styles.tagRow}>
              {item.tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.body}>{item.body}</Text>

            <View style={styles.actionsRow}>
              <Pressable style={[styles.primaryBtn, speaking && { opacity: 0.6 }]} onPress={handleReadAloud} disabled={speaking}>
                <Ionicons name={speaking ? "volume-medium" : "volume-high-outline"} size={18} color={colors.ink} />
                <Text style={styles.primaryText}>{speaking ? "Speaking…" : "Read aloud"}</Text>
              </Pressable>

              <Pressable style={styles.secondaryBtn}>
                <Ionicons name="share-social-outline" size={18} color={colors.earth} />
                <Text style={styles.secondaryText}>Share</Text>
              </Pressable>
            </View>

            {saved ? (
              <View style={styles.offlinePill}>
                <Ionicons name="cloud-done-outline" size={14} color={colors.primary} />
                <Text style={styles.offlineText}>Available offline</Text>
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
  hTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },
  saveBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.22)" },

  content: { paddingTop: 12, paddingBottom: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
  title: { fontSize: 14, fontWeight: "900", color: colors.ink },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.22)" },
  tagText: { fontSize: 10, fontWeight: "900", color: colors.earth, letterSpacing: 0.6 },

  body: { fontSize: 12, fontWeight: "700", color: colors.muted, lineHeight: 17 as any },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 14, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(19,236,91,0.35)" },
  primaryText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.ink },

  secondaryBtn: { width: 120, backgroundColor: "rgba(139,94,60,0.10)", borderRadius: 18, paddingVertical: 14, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(139,94,60,0.22)" },
  secondaryText: { fontSize: 11, fontWeight: "900", color: colors.earth },

  offlinePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(19,236,91,0.12)", borderWidth: 1, borderColor: "rgba(19,236,91,0.22)" },
  offlineText: { fontSize: 10, fontWeight: "900", color: colors.ink },
});
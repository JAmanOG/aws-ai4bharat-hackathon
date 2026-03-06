/**
 * Practice Log Screen — log farming practices, view history, analyze sustainability.
 * Integrates: POST practices/log, GET practices/logs, POST practices/analyze
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { usePracticeLogs, useHealthCheck } from "../hooks/useData";
import { precisionApi } from "../services/api";

const PRACTICE_TYPES = [
  { key: "organic_fertilizer", label: "Organic Fertilizer", icon: "leaf" as const },
  { key: "crop_rotation", label: "Crop Rotation", icon: "repeat" as const },
  { key: "water_conservation", label: "Water Conservation", icon: "water" as const },
  { key: "mulching", label: "Mulching", icon: "layers" as const },
  { key: "integrated_pest_mgmt", label: "IPM", icon: "bug" as const },
  { key: "cover_cropping", label: "Cover Cropping", icon: "flower" as const },
];

export default function PracticeLogScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const logs = usePracticeLogs();
  const isOnline = health.data?.status === "ok";

  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const logList = (logs.data as any)?.practices ?? (logs.data as any)?.logs ?? [];

  const handleLog = useCallback(async () => {
    if (!selectedType) return Alert.alert("Required", "Select a practice type");
    setLogging(true);
    try {
      await precisionApi.logPractice({
        practice_type: selectedType,
        crop_type: "general",
        notes: notes.trim(),
        date: new Date().toISOString().split("T")[0],
      });
      Alert.alert("Logged!", "Practice recorded successfully");
      setShowForm(false);
      setSelectedType("");
      setNotes("");
      logs.refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not log practice");
    } finally {
      setLogging(false);
    }
  }, [selectedType, notes]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      const res = await precisionApi.analyzePractices({ crop_type: "general", practices: [] });
      setAnalysis(res);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not analyze");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const practiceIcon = (type: string) => {
    const found = PRACTICE_TYPES.find(p => p.key === type);
    return found?.icon ?? "leaf";
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Practice Log</Text>
        <Pressable onPress={handleAnalyze} hitSlop={12} disabled={analyzing}>
          {analyzing ? <ActivityIndicator size="small" color={colors.primary} /> : (
            <Ionicons name="analytics" size={22} color={colors.primary} />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Analysis card */}
        {analysis && (
          <View style={styles.analysisCard}>
            <Ionicons name="leaf" size={20} color={colors.success} />
            <Text style={styles.analysisTitle}>Sustainability Score</Text>
            <Text style={styles.analysisScore}>{analysis.sustainability_score ?? analysis.score ?? "—"}/10</Text>
            {analysis.recommendations && (
              <Text style={styles.analysisTip}>{typeof analysis.recommendations === "string" ? analysis.recommendations : analysis.recommendations[0] ?? ""}</Text>
            )}
            {analysis.carbon_impact && (
              <View style={styles.carbonRow}>
                <Ionicons name="globe" size={12} color={colors.success} />
                <Text style={styles.carbonText}>Carbon impact: {analysis.carbon_impact}</Text>
              </View>
            )}
          </View>
        )}

        {/* Quick-add form */}
        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Log a Practice</Text>
            <View style={styles.typeGrid}>
              {PRACTICE_TYPES.map((p) => (
                <Pressable
                  key={p.key}
                  style={[styles.typeChip, selectedType === p.key && styles.typeChipActive]}
                  onPress={() => setSelectedType(p.key)}
                >
                  <Ionicons name={p.icon} size={14} color={selectedType === p.key ? "#FFF" : colors.primary} />
                  <Text style={[styles.typeChipText, selectedType === p.key && { color: "#FFF" }]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, { minHeight: 70 }]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setShowForm(false)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.cta, { flex: 1 }]} onPress={handleLog} disabled={logging}>
                {logging ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                    <Text style={styles.ctaText}>Log</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.cta} onPress={() => setShowForm(true)}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.ctaText}>Log Practice</Text>
          </Pressable>
        )}

        {/* Practice log history */}
        <Text style={styles.sectionTitle}>History ({logList.length})</Text>
        {logs.loading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
        ) : logList.length > 0 ? logList.map((l: any, i: number) => (
          <View key={l.practice_id ?? l.id ?? i} style={styles.logRow}>
            <View style={styles.logIcon}>
              <Ionicons name={practiceIcon(l.practice_type)} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logType}>
                {PRACTICE_TYPES.find(p => p.key === l.practice_type)?.label ?? l.practice_type ?? "Practice"}
              </Text>
              {l.notes && <Text style={styles.logNotes} numberOfLines={1}>{l.notes}</Text>}
              <Text style={styles.logDate}>{l.date ?? l.created_at ?? ""}</Text>
            </View>
            {l.sustainability_points && (
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsText}>+{l.sustainability_points}</Text>
              </View>
            )}
          </View>
        )) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="leaf-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No practices logged yet</Text>
            <Text style={styles.emptySub}>Start logging your farming practices to track sustainability</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },
  content: { padding: 16, paddingBottom: 100 },
  analysisCard: { backgroundColor: colors.successTint, borderRadius: 18, padding: 20, alignItems: "center", gap: 6, marginBottom: 14 },
  analysisTitle: { fontSize: 12, fontWeight: "700", color: colors.success },
  analysisScore: { fontSize: 28, fontWeight: "900", color: colors.success },
  analysisTip: { fontSize: 11, fontWeight: "600", color: colors.ink, textAlign: "center" },
  carbonRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  carbonText: { fontSize: 10, fontWeight: "700", color: colors.success },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "900", color: colors.ink },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primaryTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  typeChipActive: { backgroundColor: colors.primary },
  typeChipText: { fontSize: 11, fontWeight: "800", color: colors.primary },
  input: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, fontSize: 13, fontWeight: "700", color: colors.ink, borderWidth: 1, borderColor: colors.border },
  secondaryBtn: { alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
  secondaryText: { fontSize: 13, fontWeight: "800", color: colors.muted },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: colors.ink, marginTop: 10, marginBottom: 10 },
  logRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  logIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  logType: { fontSize: 13, fontWeight: "800", color: colors.ink },
  logNotes: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 1 },
  logDate: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 2 },
  pointsBadge: { backgroundColor: colors.successTint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pointsText: { fontSize: 11, fontWeight: "900", color: colors.success },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
  emptyWrap: { alignItems: "center", paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: "800", color: colors.ink },
  emptySub: { fontSize: 11, fontWeight: "600", color: colors.muted, textAlign: "center" },
});

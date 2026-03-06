/**
 * Insurance Claims Screen — view/file insurance claims.
 * Integrates: GET /economics/insurance/claims, POST insurance/claim
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
import { useInsuranceClaims, useHealthCheck } from "../hooks/useData";
import { economicsApi } from "../services/api";

export default function InsuranceClaimsScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const claims = useInsuranceClaims();
  const isOnline = health.data?.status === "ok";

  const [showForm, setShowForm] = useState(false);
  const [claimType, setClaimType] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [filing, setFiling] = useState(false);

  const claimList = (claims.data as any)?.claims ?? [];

  const handleFileClaim = useCallback(async () => {
    if (!claimType.trim()) return Alert.alert("Required", "Enter claim type");
    if (!description.trim()) return Alert.alert("Required", "Describe the damage");
    setFiling(true);
    try {
      await economicsApi.createInsuranceClaim({
        claim_type: claimType.trim(),
        description: description.trim(),
        claimed_amount: Number(amount) || 0,
      });
      Alert.alert("Filed!", "Your insurance claim has been submitted");
      setShowForm(false);
      setClaimType("");
      setDescription("");
      setAmount("");
      claims.refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not file claim");
    } finally {
      setFiling(false);
    }
  }, [claimType, description, amount]);

  const statusIcon = (s: string) => {
    switch (s) {
      case "approved": return { icon: "checkmark-circle" as const, color: colors.success, bg: colors.successTint };
      case "rejected": return { icon: "close-circle" as const, color: colors.danger, bg: "#FEE2E2" };
      case "processing": return { icon: "time" as const, color: colors.primary, bg: colors.primaryTint };
      default: return { icon: "hourglass" as const, color: colors.warn, bg: colors.warnTint };
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Insurance Claims</Text>
        <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.primaryTint }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{claimList.length}</Text>
            <Text style={styles.statLabel}>Total Claims</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.successTint }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{claimList.filter((c: any) => c.status === "approved").length}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warnTint }]}>
            <Text style={[styles.statValue, { color: colors.warn }]}>{claimList.filter((c: any) => c.status === "pending" || c.status === "processing").length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        {/* File claim form */}
        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>File New Claim</Text>
            <TextInput
              style={styles.input}
              placeholder="Claim type (e.g. crop damage, flood)"
              placeholderTextColor={colors.muted}
              value={claimType}
              onChangeText={setClaimType}
            />
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              placeholder="Describe the damage or loss..."
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              placeholder="Claimed amount (₹)"
              placeholderTextColor={colors.muted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setShowForm(false)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.cta, { flex: 1 }]} onPress={handleFileClaim} disabled={filing}>
                {filing ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="shield-checkmark" size={16} color="#FFF" />
                    <Text style={styles.ctaText}>Submit</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.cta} onPress={() => setShowForm(true)}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.ctaText}>File New Claim</Text>
          </Pressable>
        )}

        {/* Claims list */}
        <Text style={styles.sectionTitle}>Your Claims</Text>
        {claims.loading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
        ) : claimList.length > 0 ? claimList.map((c: any) => {
          const st = statusIcon(c.status);
          return (
            <View key={c.claim_id ?? c.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.statusIcon, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon} size={16} color={st.color} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>{c.claim_type ?? "Claim"}</Text>
                    <Text style={styles.cardDate}>{c.filed_date ?? c.created_at ?? ""}</Text>
                  </View>
                </View>
                <Text style={[styles.statusText, { color: st.color }]}>{(c.status ?? "pending").toUpperCase()}</Text>
              </View>
              <Text style={styles.cardDesc}>{c.description ?? ""}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.amountText}>Claimed: ₹{c.claimed_amount ?? 0}</Text>
                {c.approved_amount !== undefined && <Text style={[styles.amountText, { color: colors.success }]}>Approved: ₹{c.approved_amount}</Text>}
              </View>
            </View>
          );
        }) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="shield-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyTitle}>No claims filed</Text>
            <Text style={styles.emptySub}>File a claim if you've experienced crop damage or loss</Text>
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { padding: 16, paddingBottom: 100 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center", gap: 2 },
  statValue: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "700", color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, gap: 10 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "900", color: colors.ink },
  cardDate: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 1 },
  cardDesc: { fontSize: 12, fontWeight: "600", color: colors.muted },
  statusIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  amountText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: colors.ink, marginTop: 10, marginBottom: 10 },
  input: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, fontSize: 13, fontWeight: "700", color: colors.ink, borderWidth: 1, borderColor: colors.border },
  secondaryBtn: { alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
  secondaryText: { fontSize: 13, fontWeight: "800", color: colors.muted },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: colors.ink },
  emptySub: { fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center" },
});

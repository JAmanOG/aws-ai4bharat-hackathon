/**
 * Bargaining Groups Screen — browse/join/create collective bargaining groups.
 * Integrates: GET /agriculture/bargaining/groups, POST join, POST create, GET suggest
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
import { useBargainingGroups, useBargainingSuggestions, useHealthCheck } from "../hooks/useData";
import { logisticsApi } from "../services/api";

export default function BargainingGroupsScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const groups = useBargainingGroups();
  const suggestions = useBargainingSuggestions();
  const isOnline = health.data?.status === "ok";

  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [cropType, setCropType] = useState("");
  const [targetQty, setTargetQty] = useState("");

  const groupList = (groups.data as any)?.groups ?? [];
  const suggestList = (suggestions.data as any)?.suggestions ?? (suggestions.data as any)?.groups ?? [];

  const handleJoin = useCallback(async (groupId: string, groupName: string) => {
    try {
      await logisticsApi.joinBargainingGroup(groupId);
      Alert.alert("Joined!", `You joined "${groupName}". Start bargaining together!`);
      groups.refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not join group");
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!cropType.trim()) return Alert.alert("Required", "Enter crop type");
    setCreating(true);
    try {
      await logisticsApi.createBargainingGroup({
        crop_type: cropType.trim(),
        target_quantity_kg: Number(targetQty) || 1000,
      });
      Alert.alert("Created!", "Your bargaining group is ready.");
      setShowCreate(false);
      setCropType("");
      setTargetQty("");
      groups.refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not create group");
    } finally {
      setCreating(false);
    }
  }, [cropType, targetQty]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Collective Bargaining</Text>
        <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Suggestions */}
        {suggestList.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Suggested For You</Text>
            {suggestList.slice(0, 3).map((s: any, i: number) => (
              <View key={s.group_id ?? i} style={styles.groupRow}>
                <View style={[styles.groupIcon, { backgroundColor: colors.successTint }]}>
                  <Ionicons name="flash" size={16} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName}>{s.group_name ?? s.crop_type ?? "Group"}</Text>
                  <Text style={styles.groupMeta}>{s.member_count ?? 0} members • {s.crop_type ?? "mixed"}</Text>
                </View>
                <Pressable
                  style={styles.joinBtn}
                  onPress={() => handleJoin(s.group_id, s.group_name ?? s.crop_type)}
                >
                  <Text style={styles.joinText}>Join</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Active groups */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Groups</Text>
          {groups.loading ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
          ) : groupList.length > 0 ? groupList.map((g: any) => (
            <View key={g.group_id} style={styles.groupRow}>
              <View style={[styles.groupIcon, { backgroundColor: colors.primaryTint }]}>
                <Ionicons name="people" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{g.group_name ?? g.crop_type}</Text>
                <Text style={styles.groupMeta}>
                  {g.member_count ?? 0} members • {g.total_quantity_kg ? `${g.total_quantity_kg}kg` : g.crop_type}
                </Text>
              </View>
              <Pressable
                style={styles.joinBtn}
                onPress={() => handleJoin(g.group_id, g.group_name)}
              >
                <Text style={styles.joinText}>Join</Text>
              </Pressable>
            </View>
          )) : (
            <Text style={styles.emptyText}>No active groups. Create one below!</Text>
          )}
        </View>

        {/* Create group form */}
        {showCreate ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create New Group</Text>
            <TextInput
              style={styles.input}
              placeholder="Crop type (e.g. wheat, rice)"
              placeholderTextColor={colors.muted}
              value={cropType}
              onChangeText={setCropType}
            />
            <TextInput
              style={styles.input}
              placeholder="Target quantity (kg)"
              placeholderTextColor={colors.muted}
              value={targetQty}
              onChangeText={setTargetQty}
              keyboardType="numeric"
            />
            <Pressable style={styles.cta} onPress={handleCreate} disabled={creating}>
              {creating ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Ionicons name="add-circle" size={18} color="#FFF" />
                  <Text style={styles.ctaText}>Create Group</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.cta} onPress={() => setShowCreate(true)}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.ctaText}>Create Bargaining Group</Text>
          </Pressable>
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
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "900", color: colors.ink },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  groupIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  groupName: { fontSize: 13, fontWeight: "800", color: colors.ink },
  groupMeta: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 2 },
  joinBtn: { backgroundColor: colors.primaryTint, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  joinText: { fontSize: 12, fontWeight: "900", color: colors.primary },
  emptyText: { fontSize: 12, color: colors.muted, fontWeight: "600", textAlign: "center", paddingVertical: 12 },
  input: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, fontSize: 13, fontWeight: "700", color: colors.ink, borderWidth: 1, borderColor: colors.border },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
});

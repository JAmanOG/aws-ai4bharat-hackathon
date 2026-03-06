/**
 * Peer Group Detail Screen — view group details, join/leave, see members.
 * Integrates: GET peerGroup/:id, POST join, DELETE leave
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { knowledgeApi } from "../services/api";

export default function PeerGroupDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const groupId = route.params?.groupId ?? route.params?.id;
  const groupName = route.params?.groupName ?? "Peer Group";

  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(route.params?.isMember ?? false);
  const [acting, setActing] = useState(false);

  const fetchGroup = useCallback(async () => {
    try {
      const res = (await knowledgeApi.getPeerGroup(groupId)) as any;
      setGroup(res);
      if (res.is_member !== undefined) setIsMember(res.is_member);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  const handleJoin = useCallback(async () => {
    setActing(true);
    try {
      await knowledgeApi.joinPeerGroup(groupId);
      setIsMember(true);
      Alert.alert("Joined!", `You are now a member of ${groupName}`);
      fetchGroup();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not join");
    } finally {
      setActing(false);
    }
  }, [groupId, groupName, fetchGroup]);

  const handleLeave = useCallback(async () => {
    Alert.alert("Leave Group?", `Are you sure you want to leave "${groupName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setActing(true);
          try {
            await knowledgeApi.leavePeerGroup(groupId);
            setIsMember(false);
            Alert.alert("Left", "You have left the group");
            fetchGroup();
          } catch (e: any) {
            Alert.alert("Error", e.message ?? "Could not leave");
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  }, [groupId, groupName, fetchGroup]);

  const members = group?.members ?? [];
  const topics = group?.topics ?? group?.focus_areas ?? [];
  const stats = group?.stats ?? {};

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 40 }} />
        ) : (
          <>
            {/* Group info banner */}
            <View style={styles.banner}>
              <View style={styles.bannerIcon}>
                <Ionicons name="people" size={32} color={colors.primary} />
              </View>
              <Text style={styles.bannerTitle}>{group?.group_name ?? groupName}</Text>
              <Text style={styles.bannerSub}>{group?.description ?? group?.category ?? "Peer learning group"}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{group?.member_count ?? members.length}</Text>
                  <Text style={styles.statLabel}>Members</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{topics.length || stats.topics_count || 0}</Text>
                  <Text style={styles.statLabel}>Topics</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.posts_count ?? stats.discussions ?? 0}</Text>
                  <Text style={styles.statLabel}>Discussions</Text>
                </View>
              </View>

              {/* Membership badge */}
              {isMember && (
                <View style={styles.memberBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.memberBadgeText}>Member</Text>
                </View>
              )}
            </View>

            {/* Join/Leave action */}
            {isMember ? (
              <Pressable style={styles.leaveBtn} onPress={handleLeave} disabled={acting}>
                {acting ? <ActivityIndicator color={colors.danger} /> : (
                  <>
                    <Ionicons name="log-out" size={16} color={colors.danger} />
                    <Text style={styles.leaveBtnText}>Leave Group</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable style={styles.cta} onPress={handleJoin} disabled={acting}>
                {acting ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="add-circle" size={18} color="#FFF" />
                    <Text style={styles.ctaText}>Join Group</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Topics/Focus areas */}
            {topics.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Focus Areas</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
                  {topics.map((t: string, i: number) => (
                    <View key={i} style={styles.topicChip}>
                      <Text style={styles.topicText}>{t}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Members list */}
            {members.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Members ({members.length})</Text>
                {members.slice(0, 20).map((m: any, i: number) => (
                  <View key={m.user_id ?? i} style={styles.memberRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{(m.name ?? m.user_id ?? "?")[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.name ?? m.user_id ?? `Member ${i + 1}`}</Text>
                      {m.role && <Text style={styles.memberRole}>{m.role}</Text>}
                    </View>
                    {m.role === "admin" && (
                      <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                    )}
                  </View>
                ))}
              </>
            )}
          </>
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
  banner: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.border, gap: 8, marginBottom: 14 },
  bannerIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontSize: 18, fontWeight: "900", color: colors.ink, textAlign: "center" },
  bannerSub: { fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 20, marginTop: 8 },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "900", color: colors.ink },
  statLabel: { fontSize: 10, fontWeight: "600", color: colors.muted },
  memberBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.successTint, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 4 },
  memberBadgeText: { fontSize: 11, fontWeight: "800", color: colors.success },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: colors.ink, marginBottom: 10, marginTop: 10 },
  topicChip: { backgroundColor: colors.primaryTint, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  topicText: { fontSize: 12, fontWeight: "800", color: colors.primary },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  avatarCircle: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "900", color: colors.primary },
  memberName: { fontSize: 13, fontWeight: "800", color: colors.ink },
  memberRole: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 1 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, marginBottom: 14, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
  leaveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#FEE2E2", borderRadius: 14, paddingVertical: 14, marginBottom: 14 },
  leaveBtnText: { fontSize: 14, fontWeight: "800", color: colors.danger },
});

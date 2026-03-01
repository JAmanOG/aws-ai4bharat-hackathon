/**
 * Knowledge Dashboard — skill course progress, peer learning groups, audio stream.
 * Matches reference: progress card, peer groups, audio stream LIVE badge.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useCourses, usePeerGroups, useLearningProfile } from "../hooks/useData";
import { LoadingView, ErrorView } from "../components/ui";

export default function KnowledgeDashboardScreen() {
  const nav = useNavigation<any>();
  const courses = useCourses();
  const groups = usePeerGroups();
  const profile = useLearningProfile();

  const courseList = (courses.data as any)?.courses ?? [];
  const groupList = (groups.data as any)?.groups ?? [];
  const progressData = profile.data as any;

  const loading = courses.loading || groups.loading;
  const error = courses.error || groups.error;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Ionicons name="cloud-offline-outline" size={14} color={colors.muted} />
        <Text style={styles.statusLabel}>Offline</Text>
        <View style={styles.div} />
        <Text style={styles.statusLabel}>Offline Mode - Sync Pending</Text>
      </View>

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Knowledge Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <LoadingView message="Loading knowledge data…" />
      ) : error ? (
        <ErrorView message="Could not load data" onRetry={courses.refresh} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Progress card */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressTitle}>Your progress in an{"\n"}skill course</Text>
                <View style={styles.progressBarWrap}>
                  <Text style={styles.progressLabel}>Your progress</Text>
                  <View style={styles.trackBg}>
                    <View style={[styles.trackFill, { width: "65%" }]} />
                  </View>
                </View>
                <Text style={styles.progressSub}>Progress in 3 Skills</Text>
              </View>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>33</Text>
              </View>
            </View>
          </View>

          {/* Peer Learning Groups */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Peer Learning Groups</Text>
            <Text style={styles.sectionActive}>Active</Text>
          </View>

          {/* Group card */}
          <Pressable style={styles.groupCard}>
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.groupName}>st.clusters</Text>
                <Text style={styles.groupProp}>Property 15</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                {/* avatar dots */}
                {["#4A90D9", "#22C55E", "#F59E0B"].map((c, i) => (
                  <View key={i} style={[styles.avatar, { backgroundColor: c, marginLeft: i > 0 ? -6 : 0 }]} />
                ))}
                <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginLeft: 4 }} />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          {/* Audio stream LIVE */}
          <View style={styles.audioCard}>
            <View style={styles.audioRow}>
              <Ionicons name="volume-high" size={18} color={colors.primary} />
              <Text style={styles.audioLabel}>Audio stream</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.audioTitle}>Dairy Production Discussion</Text>
            <Text style={styles.audioSub}>(Twitter Space-like)</Text>
            {/* Avatars + Expert */}
            <View style={styles.audioFooter}>
              <View style={{ flexDirection: "row" }}>
                {["#4A90D9", "#F59E0B", "#22C55E"].map((c, i) => (
                  <View key={i} style={[styles.avatar, { backgroundColor: c, marginLeft: i > 0 ? -6 : 0, width: 28, height: 28, borderRadius: 14 }]} />
                ))}
              </View>
              <View style={styles.expertBadge}>
                <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                <Text style={styles.expertText}>Expert</Text>
              </View>
            </View>
          </View>

          {/* Verified Credentials */}
          <View style={styles.credCard}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.credTitle}>Verified Credentials</Text>
              <Text style={styles.credSub}>(DigiLocker)</Text>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  statusBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 6, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },
  div: { width: 1, height: 12, backgroundColor: colors.border, marginHorizontal: 4 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "900", color: colors.ink },

  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  /* Progress */
  progressCard: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, padding: 16,
  },
  progressHeader: { flexDirection: "row", alignItems: "flex-start" },
  progressTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, lineHeight: 20 },
  progressBarWrap: { marginTop: 12 },
  progressLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 4 },
  trackBg: { height: 6, borderRadius: 3, backgroundColor: colors.border },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  progressSub: { marginTop: 6, fontSize: 11, fontWeight: "700", color: colors.muted },
  scoreBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.primary, marginLeft: 12,
  },
  scoreText: { fontSize: 16, fontWeight: "900", color: colors.primary },

  /* Sections */
  sectionRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 18, marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: colors.ink },
  sectionActive: { fontSize: 12, fontWeight: "800", color: colors.success },

  /* Group */
  groupCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: colors.border, padding: 12,
  },
  groupIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center",
  },
  groupName: { fontSize: 13, fontWeight: "900", color: colors.ink },
  groupProp: { fontSize: 10, fontWeight: "600", color: colors.muted },
  avatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#FFF" },

  /* Audio */
  audioCard: {
    marginTop: 12, backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  audioRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  audioLabel: { fontSize: 12, fontWeight: "800", color: colors.ink },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.dangerTint, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  liveText: { fontSize: 9, fontWeight: "900", color: colors.danger, letterSpacing: 0.4 },
  audioTitle: { marginTop: 8, fontSize: 14, fontWeight: "800", color: colors.ink },
  audioSub: { fontSize: 11, fontWeight: "600", color: colors.muted },
  audioFooter: {
    marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  expertBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: colors.primaryTint,
  },
  expertText: { fontSize: 10, fontWeight: "900", color: colors.primary },

  /* Credentials */
  credCard: {
    marginTop: 12, flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: colors.border, padding: 14,
  },
  credTitle: { fontSize: 13, fontWeight: "800", color: colors.ink },
  credSub: { fontSize: 11, fontWeight: "600", color: colors.muted },
});

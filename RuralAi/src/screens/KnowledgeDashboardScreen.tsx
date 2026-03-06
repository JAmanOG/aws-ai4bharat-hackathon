/**
 * Knowledge Dashboard — skill progress, peer learning groups,
 * live audio stream, verified credentials (DigiLocker).
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
import { useCourses, usePeerGroups, useLearningProfile, useHealthCheck, useMyCourses, useMyPeerGroups } from "../hooks/useData";
import { knowledgeApi } from "../services/api";

/* ── Circular progress badge ── */
function ProgressCircle({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(score / 100, 1);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Background ring */}
      <View style={[circStyles.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: 4, borderColor: colors.border }]} />
      {/* Foreground arc (simulated with border + clip) */}
      <View style={[circStyles.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: 4, borderColor: colors.primary, borderTopColor: pct > 0.25 ? colors.primary : "transparent", borderRightColor: pct > 0.5 ? colors.primary : "transparent", borderBottomColor: pct > 0.75 ? colors.primary : "transparent", borderLeftColor: pct > 0 ? colors.primary : "transparent" }]} />
      <Text style={circStyles.text}>{score}</Text>
    </View>
  );
}
const circStyles = StyleSheet.create({
  ring: { position: "absolute" },
  text: { fontSize: 18, fontWeight: "900", color: colors.primary },
});

export default function KnowledgeDashboardScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const courses = useCourses();
  const myCourses = useMyCourses();
  const groups = usePeerGroups();
  const myGroups = useMyPeerGroups();
  const profile = useLearningProfile();
  const isOnline = health.data?.status === "ok";

  const courseList = (courses.data as any)?.courses ?? [];
  const myEnrollments = (myCourses.data as any)?.enrollments ?? (myCourses.data as any)?.courses ?? [];
  const groupList = (myGroups.data as any)?.groups ?? (groups.data as any)?.groups ?? (groups.data as any) ?? [];
  const skillScore = (profile.data as any)?.score ?? (profile.data as any)?.skill_score ?? 0;
  const displayCourses = myEnrollments.length > 0 ? myEnrollments : courseList;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Knowledge Hub</Text>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Skill progress card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Skill Progress</Text>
              <Text style={styles.cardSub}>{displayCourses.length} courses {myEnrollments.length > 0 ? "enrolled" : "available"}</Text>
            </View>
            <ProgressCircle score={skillScore} />
          </View>
          {/* Course items */}
          {displayCourses.length > 0 ? displayCourses.slice(0, 3).map((c: any) => (
            <Pressable
              key={c.course_id ?? c.id ?? c.title}
              style={styles.courseRow}
              onPress={() => c.course_id && nav.navigate("CourseDetail", { courseId: c.course_id })}
            >
              <View style={styles.courseIcon}>
                <Ionicons name="book" size={14} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseName}>{c.title}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${(c.progress ?? 0) * 100}%` }]} />
                </View>
              </View>
              <Text style={styles.progressPct}>{Math.round((c.progress ?? 0) * 100)}%</Text>
            </Pressable>
          )) : (
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
                {courses.loading ? "Loading courses…" : "No courses available yet"}
              </Text>
            </View>
          )}
        </View>

        {/* Peer learning groups */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Peer Learning Groups</Text>
          {groupList.length > 0 ? groupList.slice(0, 3).map((g: any) => (
            <Pressable
              key={g.group_id ?? g.id ?? g.name}
              style={styles.groupRow}
              onPress={() => (g.group_id || g.id) && nav.navigate("PeerGroupDetail", { groupId: g.group_id ?? g.id })}
            >
              <View style={[styles.groupIcon, g.verified && { backgroundColor: colors.successTint }]}>
                <Ionicons name="people" size={16} color={g.verified ? colors.success : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={styles.groupName}>{g.group_name ?? g.name}</Text>
                  {g.verified && <Ionicons name="checkmark-circle" size={13} color={colors.success} />}
                </View>
                <Text style={styles.groupMeta}>{g.member_count ?? g.members ?? 0} members • {g.crop_type ?? "Active"}</Text>
              </View>
              <View style={styles.avatarStack}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.avatar, { left: i * 14, backgroundColor: ["#BDD4EE", "#B5E6C5", "#FDE68A"][i] }]}>
                    <Text style={styles.avatarText}>{["S", "A", "R"][i]}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          )) : (
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
                {groups.loading ? "Loading groups…" : "No peer groups yet — join one!"}
              </Text>
            </View>
          )}
        </View>

        {/* Audio stream card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.cardTitle}>Audio Streams</Text>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.cardSub}>Expert talks available now</Text>
            </View>
            <Pressable style={styles.playBtn}>
              <Ionicons name="play" size={18} color="#FFF" />
            </Pressable>
          </View>
          <View style={styles.expertRow}>
            <View style={styles.expertAvatar}>
              <Ionicons name="person" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.expertName}>Dr. Sharma</Text>
              <Text style={styles.expertTopic}>Soil Health Management</Text>
            </View>
            <View style={styles.expertBadge}>
              <Ionicons name="shield-checkmark" size={11} color={colors.success} />
              <Text style={styles.expertBadgeText}>Expert</Text>
            </View>
          </View>
        </View>

        {/* Verified credentials */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Verified Credentials</Text>
              <Text style={styles.cardSub}>DigiLocker integration</Text>
            </View>
            <Ionicons name="shield-checkmark" size={24} color={colors.success} />
          </View>
          <View style={styles.credRow}>
            <Ionicons name="document-text" size={16} color={colors.primary} />
            <Text style={styles.credText}>Land Record — Verified</Text>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          </View>
          <View style={styles.credRow}>
            <Ionicons name="card" size={16} color={colors.primary} />
            <Text style={styles.credText}>Aadhaar — Linked</Text>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  content: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border, gap: 12, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "900", color: colors.ink },
  cardSub: { fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: 2 },
  courseRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  courseIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  courseName: { fontSize: 12, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  progressPct: { fontSize: 11, fontWeight: "800", color: colors.primary, width: 34, textAlign: "right" },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  groupIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  groupName: { fontSize: 12, fontWeight: "800", color: colors.ink },
  groupMeta: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 1 },
  avatarStack: { width: 52, height: 24, position: "relative" },
  avatar: { position: "absolute", width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#FFF", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 8, fontWeight: "900", color: colors.ink },
  liveBadge: { backgroundColor: colors.danger, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  liveBadgeText: { fontSize: 9, fontWeight: "900", color: "#FFF", letterSpacing: 0.4 },
  playBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  expertRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  expertAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  expertName: { fontSize: 12, fontWeight: "800", color: colors.ink },
  expertTopic: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 1 },
  expertBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.successTint, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  expertBadgeText: { fontSize: 9, fontWeight: "800", color: colors.success },
  credRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  credText: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.ink },
});

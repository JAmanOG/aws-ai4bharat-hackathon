/**
 * Course Detail Screen — view course content, enroll, complete modules.
 * Integrates: GET course/:id, POST enroll, POST completeModule, GET content
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useCourseContent } from "../hooks/useData";
import { knowledgeApi } from "../services/api";

export default function CourseDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const courseId = route.params?.courseId ?? route.params?.id;
  const courseName = route.params?.courseName ?? "Course";

  const content = useCourseContent(courseId);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(route.params?.enrolled ?? false);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());

  const modules = (content.data as any)?.modules ?? (content.data as any)?.content ?? [];
  const courseInfo = (content.data as any)?.course ?? {};

  const handleEnroll = useCallback(async () => {
    setEnrolling(true);
    try {
      await knowledgeApi.enrollCourse(courseId);
      setEnrolled(true);
      Alert.alert("Enrolled!", `You are now enrolled in ${courseName}`);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not enroll");
    } finally {
      setEnrolling(false);
    }
  }, [courseId, courseName]);

  const handleCompleteModule = useCallback(async (moduleId: string, moduleTitle: string) => {
    try {
      await knowledgeApi.completeModule(courseId, moduleId);
      setCompletedModules((prev) => new Set(prev).add(moduleId));
      Alert.alert("Completed!", `"${moduleTitle}" marked complete`);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not mark complete");
    }
  }, [courseId]);

  const progress = modules.length > 0 ? Math.round((completedModules.size / modules.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{courseName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Course banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="school" size={32} color={colors.primary} />
          </View>
          <Text style={styles.bannerTitle}>{courseName}</Text>
          <Text style={styles.bannerSub}>{courseInfo.description ?? courseInfo.category ?? "Agricultural course"}</Text>
          {courseInfo.duration && (
            <View style={styles.metaRow}>
              <Ionicons name="time" size={12} color={colors.muted} />
              <Text style={styles.metaText}>{courseInfo.duration}</Text>
            </View>
          )}
          {enrolled && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
          )}
        </View>

        {/* Enroll CTA */}
        {!enrolled && (
          <Pressable style={styles.cta} onPress={handleEnroll} disabled={enrolling}>
            {enrolling ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Ionicons name="log-in" size={18} color="#FFF" />
                <Text style={styles.ctaText}>Enroll in Course</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Modules */}
        <Text style={styles.sectionTitle}>Modules ({modules.length})</Text>
        {content.loading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
        ) : modules.length > 0 ? modules.map((m: any, i: number) => {
          const mId = m.module_id ?? m.id ?? String(i);
          const done = completedModules.has(mId) || m.completed;
          return (
            <View key={mId} style={styles.moduleCard}>
              <View style={[styles.moduleNum, done && { backgroundColor: colors.success }]}>
                {done ? (
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                ) : (
                  <Text style={styles.moduleNumText}>{i + 1}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.moduleName, done && { color: colors.muted }]}>{m.title ?? m.name ?? `Module ${i + 1}`}</Text>
                {m.description && <Text style={styles.moduleSub} numberOfLines={2}>{m.description}</Text>}
                {m.content_type && (
                  <View style={styles.metaRow}>
                    <Ionicons name={m.content_type === "video" ? "videocam" : "document-text"} size={10} color={colors.muted} />
                    <Text style={styles.metaText}>{m.content_type} • {m.duration ?? ""}</Text>
                  </View>
                )}
              </View>
              {enrolled && !done && (
                <Pressable style={styles.completeBtn} onPress={() => handleCompleteModule(mId, m.title ?? `Module ${i + 1}`)}>
                  <Text style={styles.completeBtnText}>Done</Text>
                </Pressable>
              )}
            </View>
          );
        }) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No modules available</Text>
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
  banner: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.border, gap: 8, marginBottom: 14 },
  bannerIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontSize: 18, fontWeight: "900", color: colors.ink, textAlign: "center" },
  bannerSub: { fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 10, fontWeight: "600", color: colors.muted },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", marginTop: 4 },
  progressBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.bg },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.success },
  progressText: { fontSize: 11, fontWeight: "900", color: colors.success },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: colors.ink, marginBottom: 10, marginTop: 6 },
  moduleCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  moduleNum: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  moduleNumText: { fontSize: 12, fontWeight: "900", color: "#FFF" },
  moduleName: { fontSize: 13, fontWeight: "800", color: colors.ink },
  moduleSub: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 2 },
  completeBtn: { backgroundColor: colors.successTint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  completeBtnText: { fontSize: 11, fontWeight: "900", color: colors.success },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, marginBottom: 14, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
  emptyWrap: { alignItems: "center", paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 12, fontWeight: "600", color: colors.muted },
});

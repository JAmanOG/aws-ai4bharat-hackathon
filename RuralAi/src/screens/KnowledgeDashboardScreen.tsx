/**
 * Knowledge Dashboard — Requirement 7 hub.
 * Surfaces official courses, curated videos/articles, live learning, and peer groups.
 */

import React, { useMemo } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import {
  useCourses,
  useGovtCourses,
  useHealthCheck,
  useKnowledgeResourceSearch,
  useMemoryFacts,
  useMyCourses,
  usePeerGroups,
  useVoiceRooms,
} from "../hooks/useData";
import { buildKnowledgeContent } from "../utils/knowledgeResources";
import {
  buildKnowledgeBanner,
  buildVoiceLearningProfile,
  deriveLearningQuery,
  getGroupMemberCount,
  normalizeFacts,
  rankKnowledgeItems,
  selectRelevantPeerGroups,
} from "../features/knowledge/dashboardData";
import { useVoice } from "../voice/VoiceContext";

const palette = {
  bg: "#F5EEDD",
  paper: "#FFF9EF",
  ink: "#1E1710",
  muted: "#6F6457",
  line: "rgba(116, 88, 50, 0.28)",
  gold: "#D5AF52",
  goldDark: "#B78D32",
  goldSoft: "rgba(213,175,82,0.18)",
  live: "#7A5628",
};

export default function KnowledgeDashboardScreen() {
  const nav = useNavigation<any>();
  const { history, lastCommand, language: voiceLanguage } = useVoice();
  const health = useHealthCheck();
  const courses = useCourses();
  const myCourses = useMyCourses();
  const groups = usePeerGroups();
  const govtCourses = useGovtCourses();
  const memoryFacts = useMemoryFacts();
  const liveRooms = useVoiceRooms({ status: "active", limit: 3 });

  const discoverGroupList = Array.isArray(groups.data) ? groups.data : (groups.data as any)?.groups ?? [];
  const allCourses = (myCourses.data as any)?.enrollments ?? (myCourses.data as any)?.courses ?? (courses.data as any)?.courses ?? [];
  const factsMap = normalizeFacts((memoryFacts.data as any)?.facts);
  const profileData = useMemo(
    () => buildVoiceLearningProfile(factsMap, history, lastCommand, voiceLanguage, allCourses),
    [factsMap, history, lastCommand, voiceLanguage, allCourses],
  );
  const profileMatchedCourses = useMemo(
    () => rankKnowledgeItems(allCourses, profileData),
    [allCourses, profileData],
  );
  const govtList = useMemo(
    () => rankKnowledgeItems((govtCourses.data as any)?.courses ?? [], profileData),
    [govtCourses.data, profileData],
  );
  const liveRoomList = (liveRooms.data as any)?.rooms ?? [];
  const peerGroups = useMemo(
    () => selectRelevantPeerGroups(discoverGroupList, profileData),
    [discoverGroupList, profileData],
  );
  const searchQuery = deriveLearningQuery(profileData, profileMatchedCourses);
  const preferredLanguage = profileData?.preferredLanguage ?? profileMatchedCourses?.[0]?.language ?? undefined;
  const externalResources = useKnowledgeResourceSearch(searchQuery, preferredLanguage, 4);
  const content = useMemo(
    () =>
      buildKnowledgeContent({
        courses: profileMatchedCourses,
        govtCourses: govtList,
        learningProfile: profileData,
        voiceRooms: liveRoomList,
        externalSearch: externalResources.data,
        strictRealDataOnly: true,
      }),
    [profileMatchedCourses, govtList, profileData, liveRoomList, externalResources.data],
  );

  const activeLiveRoom = content.liveRooms[0];
  const fallbackLive = content.liveFallback[0];
  const isOnline = health.data?.status === "ok";
  const nextStep = buildKnowledgeBanner(profileData, content.nextSteps[0], searchQuery);
  const canOpenResources = Boolean(searchQuery);

  const openExternal = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open source", "Please try again in a moment.");
    }
  };

  const openCourseOrSource = (item: any) => {
    if (item.courseId) {
      nav.navigate("CourseDetail", { courseId: String(item.courseId), courseName: item.title });
      return;
    }
    openExternal(item.url);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}>
          <Ionicons name="chevron-back" size={22} color={palette.paper} />
        </Pressable>
        <Text style={styles.headerTitle}>Knowledge Hub</Text>
        <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nextStepBanner}>
          <Ionicons name="sparkles" size={16} color={palette.goldDark} />
          <Text style={styles.nextStepText}>{nextStep}</Text>
        </View>

        {content.featuredSources.length > 0 ? (
          content.featuredSources.slice(0, 2).map((item) => (
            <View key={item.id} style={styles.sourceCard}>
              <Thumbnail kind={item.kind} label={item.tag ?? "Official"} />
              <View style={styles.sourceBody}>
                <Text style={styles.sourceTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.sourceSub} numberOfLines={2}>{item.subtitle}</Text>
                <Pressable style={styles.sourceBtn} onPress={() => openExternal(item.url)}>
                  <Text style={styles.sourceBtnText}>{item.ctaLabel}</Text>
                  <Ionicons name="open-outline" size={16} color={palette.ink} />
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <EmptySectionCard
            title="No official learning sources yet"
            subtitle="Government sources matching this learner profile are not available right now."
          />
        )}

        <SectionHeader
          title="Popular Courses"
          action={canOpenResources ? "View All" : undefined}
          onAction={canOpenResources ? () => nav.navigate("KnowledgeResources", { initialTab: "all", query: searchQuery, language: preferredLanguage }) : undefined}
        />
        {content.popularCourses.length > 0 ? (
          <View style={styles.stack}>
            {content.popularCourses.slice(0, 2).map((item) => (
              <Pressable key={item.id} style={styles.popularCard} onPress={() => openCourseOrSource(item)}>
              <Thumbnail kind={item.kind} label={item.tag ?? "Course"} compact thumbnail={item.thumbnail} />
                <View style={styles.popularBody}>
                  <View style={styles.tagRow}>
                    <TagPill text={item.tag ?? "Course"} />
                    {item.secondaryTag ? <TagPill text={item.secondaryTag} secondary /> : null}
                  </View>
                  <Text style={styles.popularTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.popularSub} numberOfLines={2}>{item.subtitle}</Text>
                </View>
                <View style={styles.inlineAction}>
                  <Text style={styles.inlineActionText}>{item.ctaLabel}</Text>
                  <Ionicons name="arrow-forward" size={15} color={palette.ink} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptySectionCard
            title="No personalized courses yet"
            subtitle={profileData ? "Complete a course or refresh recommendations to see profile-based learning picks." : "Add learning goals in your profile to unlock personalized courses."}
          />
        )}

        <SectionHeader
          title="Live Streams"
          action={canOpenResources ? "View All" : undefined}
          onAction={canOpenResources ? () => nav.navigate("KnowledgeResources", { initialTab: "videos", query: searchQuery, language: preferredLanguage }) : undefined}
          live
        />
        {activeLiveRoom ? (
          <Pressable style={styles.liveCard} onPress={() => nav.navigate("VoiceRoom", { roomId: activeLiveRoom.roomId })}>
            <AvatarBadge name={activeLiveRoom.host} verified={activeLiveRoom.verified} />
            <View style={styles.liveBody}>
              <Text style={styles.liveHost}>{activeLiveRoom.host}</Text>
              <Text style={styles.liveTopic} numberOfLines={2}>{activeLiveRoom.title}</Text>
              <View style={styles.liveMeta}>
                <Ionicons name="people" size={13} color={palette.live} />
                <Text style={styles.liveMetaText}>{activeLiveRoom.listeners}</Text>
              </View>
            </View>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={22} color={palette.ink} />
            </View>
          </Pressable>
        ) : fallbackLive ? (
          <Pressable style={styles.liveCard} onPress={() => openExternal(fallbackLive.url)}>
            <AvatarBadge name={fallbackLive.tag ?? "YouTube"} verified />
            <View style={styles.liveBody}>
              <Text style={styles.liveHost}>{fallbackLive.tag ?? "YouTube Live"}</Text>
              <Text style={styles.liveTopic} numberOfLines={2}>{fallbackLive.title}</Text>
              <View style={styles.liveMeta}>
                <Ionicons name="radio" size={13} color={palette.live} />
                <Text style={styles.liveMetaText}>{fallbackLive.meta || "Open live search"}</Text>
              </View>
            </View>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={22} color={palette.ink} />
            </View>
          </Pressable>
        ) : (
          <EmptySectionCard
            title="No live sessions found"
            subtitle={canOpenResources ? `No active live sessions matched "${searchQuery}".` : "Set a learning topic to discover live sessions."}
          />
        )}

        <SectionHeader
          title="Peer Learning Groups"
          action="Find More Groups"
          onAction={() => nav.navigate("Community")}
        />
        {peerGroups.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupRail}>
            {peerGroups.slice(0, 6).map((group: any, index: number) => {
              const groupId = group.group_id ?? group.groupId ?? group.id;
              const memberCount = getGroupMemberCount(group);
              return (
                <Pressable
                  key={groupId ?? `${group.group_name ?? group.name}-${index}`}
                  style={styles.groupCard}
                  onPress={() => (groupId ? nav.navigate("PeerGroupDetail", { groupId }) : nav.navigate("Community"))}
                >
                  <Text style={styles.groupTitle} numberOfLines={2}>{group.group_name ?? group.name}</Text>
                  <View style={styles.groupAvatarRow}>
                    {buildInitials(group.group_name ?? group.name ?? "Group").slice(0, 4).map((initial, avatarIndex) => (
                      <View key={`${initial}-${avatarIndex}`} style={[styles.groupAvatar, { left: avatarIndex * 18 }]}>
                        <Text style={styles.groupAvatarText}>{initial}</Text>
                      </View>
                    ))}
                    <Text style={styles.groupCount}>{memberCount} Active</Text>
                  </View>
                  {group.verified ? (
                    <View style={styles.groupVerified}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                      <Text style={styles.groupVerifiedText}>Verified</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <EmptySectionCard
            title="No real peer groups to show"
            subtitle={profileData ? "Join or create a peer group to see real learning circles here." : "Set your learning goals to match with peer groups."}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
  live,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  live?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRight}>
        {action ? (
          <Pressable onPress={onAction}>
            <Text style={styles.sectionAction}>{action}</Text>
          </Pressable>
        ) : null}
        {live ? (
          <View style={styles.liveIndicator}>
            <View style={styles.liveIndicatorDot} />
            <Text style={styles.liveIndicatorText}>LIVE</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Thumbnail({ kind, label, compact, thumbnail }: { kind: string; label: string; compact?: boolean; thumbnail?: string }) {
  const iconName =
    kind === "official"
      ? "school-outline"
      : kind === "article"
        ? "logo-google"
        : kind === "live"
          ? "play-circle"
          : "logo-youtube";

  return (
    <View style={[styles.thumb, compact && styles.thumbCompact]}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.thumbImage} resizeMode="cover" />
      ) : null}
      <View style={styles.thumbOverlay}>
        <Ionicons name={iconName as any} size={compact ? 24 : 30} color={compact ? palette.goldDark : palette.paper} />
        <Text style={[styles.thumbLabel, compact && styles.thumbLabelCompact]} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

function TagPill({ text, secondary }: { text: string; secondary?: boolean }) {
  return (
    <View style={[styles.tagPill, secondary && styles.tagPillSecondary]}>
      <Text style={[styles.tagPillText, secondary && styles.tagPillTextSecondary]}>{text}</Text>
    </View>
  );
}

function AvatarBadge({ name, verified }: { name: string; verified?: boolean }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View style={styles.avatarWrap}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
      {verified ? (
        <View style={styles.avatarVerified}>
          <Ionicons name="checkmark" size={12} color={palette.paper} />
        </View>
      ) : null}
    </View>
  );
}

function EmptySectionCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="sparkles-outline" size={20} color={palette.goldDark} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

function buildInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["K", "H"];
  return parts.map((part) => part.charAt(0).toUpperCase());
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.goldDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.goldDark,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "900", color: palette.ink },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  nextStepBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.goldSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(183,141,50,0.18)",
  },
  nextStepText: { flex: 1, fontSize: 12, fontWeight: "700", color: palette.ink, lineHeight: 18 },
  emptyCard: {
    alignItems: "center",
    backgroundColor: palette.paper,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 14,
  },
  emptyTitle: { marginTop: 8, fontSize: 15, fontWeight: "900", color: palette.ink, textAlign: "center" },
  emptySubtitle: { marginTop: 6, fontSize: 12, fontWeight: "600", color: palette.muted, lineHeight: 18, textAlign: "center" },
  sourceCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: "#A78652",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  thumb: {
    width: 98,
    height: 98,
    borderRadius: 22,
    backgroundColor: palette.goldDark,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 8,
    overflow: "hidden",
  },
  thumbCompact: {
    width: 92,
    height: 92,
    backgroundColor: palette.goldSoft,
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbOverlay: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  thumbLabel: { color: palette.paper, fontSize: 11, fontWeight: "800", textAlign: "center" },
  thumbLabelCompact: { color: palette.goldDark },
  sourceBody: { flex: 1, justifyContent: "center" },
  sourceTitle: { fontSize: 16, fontWeight: "900", color: palette.ink, lineHeight: 22 },
  sourceSub: { marginTop: 4, fontSize: 12, fontWeight: "600", color: palette.muted, lineHeight: 17 },
  sourceBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E7C76C",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
    shadowColor: "#D0A841",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sourceBtnText: { fontSize: 14, fontWeight: "900", color: palette.ink },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: palette.ink },
  sectionRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionAction: { fontSize: 13, fontWeight: "700", color: palette.muted },
  liveIndicator: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveIndicatorDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.live },
  liveIndicatorText: { fontSize: 12, fontWeight: "900", color: palette.live },
  stack: { gap: 12 },
  popularCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.paper,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },
  popularBody: { flex: 1 },
  tagRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tagPill: {
    backgroundColor: "rgba(192,213,165,0.45)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagPillSecondary: { backgroundColor: "rgba(222,205,164,0.34)" },
  tagPillText: { fontSize: 11, fontWeight: "700", color: "#5D6B3A" },
  tagPillTextSecondary: { color: palette.live },
  popularTitle: { fontSize: 15, fontWeight: "900", color: palette.ink, lineHeight: 20 },
  popularSub: { marginTop: 4, fontSize: 12, fontWeight: "600", color: palette.muted, lineHeight: 16 },
  inlineAction: {
    backgroundColor: "#E7C76C",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineActionText: { fontSize: 11, fontWeight: "900", color: palette.ink },
  liveCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  avatarWrap: { position: "relative" },
  avatarCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#E7DED1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.line,
  },
  avatarInitial: { fontSize: 28, fontWeight: "900", color: palette.live },
  avatarVerified: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.goldDark,
    alignItems: "center",
    justifyContent: "center",
  },
  liveBody: { flex: 1 },
  liveHost: { fontSize: 18, fontWeight: "900", color: palette.ink },
  liveTopic: { marginTop: 2, fontSize: 14, fontWeight: "700", color: palette.ink, lineHeight: 19 },
  liveMeta: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  liveMetaText: { fontSize: 12, fontWeight: "700", color: palette.live },
  playCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E7C76C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D0A841",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  groupRail: { gap: 14, paddingRight: 8 },
  groupCard: {
    width: 220,
    minHeight: 142,
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    justifyContent: "space-between",
  },
  groupTitle: { fontSize: 16, fontWeight: "900", color: palette.ink, lineHeight: 21 },
  groupAvatarRow: { marginTop: 18, minHeight: 28, paddingLeft: 56, justifyContent: "center" },
  groupAvatar: {
    position: "absolute",
    top: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E7DED1",
    borderWidth: 2,
    borderColor: palette.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarText: { fontSize: 11, fontWeight: "900", color: palette.live },
  groupCount: { fontSize: 13, fontWeight: "700", color: palette.ink },
  groupVerified: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  groupVerifiedText: { fontSize: 12, fontWeight: "700", color: colors.success },
});

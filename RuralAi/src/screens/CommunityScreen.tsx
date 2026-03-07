import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { SyncPill } from "../components/ui";
import { usePeerGroups, useVoiceRooms } from "../hooks/useData";
import { useNavigation } from "@react-navigation/native";
import { logger } from "../utils/logger";

type Space = {
  id: string;
  title: string;
  status: "LIVE" | "SCHEDULED";
  meta: string;
  listeners?: number;
};

type Post = {
  id: string;
  name: string;
  verified?: boolean;
  time: string;
  text: string;
  tags: string[];
};

export default function CommunityScreen() {
  const nav = useNavigation<any>();
  const peerGroups = usePeerGroups();
  const voiceRooms = useVoiceRooms({ status: "active", limit: 6 });

  logger.debug("CommunityScreen", "render", { groupCount: ((peerGroups.data as any)?.groups ?? []).length, loading: peerGroups.loading });

  const handleReport = () => {
    logger.info("CommunityScreen", "Report tapped");
    Alert.alert("Report an Issue", "What would you like to report?", [
      { text: "Safety Concern", onPress: () => Alert.alert("Reported", "Thank you. Our team will review this.") },
      { text: "Misinformation", onPress: () => Alert.alert("Reported", "Thank you. Our team will review this.") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  /* Map backend peer groups to Space cards when available */
  const spaces: Space[] = React.useMemo(() => {
    const raw = (voiceRooms.data as any)?.rooms;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((room: any, i: number) => ({
      id: room.roomId ?? `r${i}`,
      title: room.title ?? "Voice room",
      status: "LIVE" as const,
      meta: `${room.participantCount ?? 0} listening • ${(room.topics || []).join(" • ") || "general"}`,
      listeners: room.participantCount ?? 0,
    }));
  }, [voiceRooms.data]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("Main", { screen: "Ask" }))}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </Pressable>

          <Text style={styles.title}>Community</Text>

          <SyncPill synced={!peerGroups.error} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Quick actions */}
          <View style={styles.quickRow}>
            <View style={styles.quickCardPrimary}>
              <Ionicons name="mic" size={18} color={colors.ink} />
              <Text style={styles.quickPrimaryText}>Use mic to post</Text>
            </View>

            <Pressable style={styles.quickCard} onPress={handleReport}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.earth} />
              <Text style={styles.quickText}>Report</Text>
            </Pressable>
          </View>

          {/* Community Spaces */}
          <SectionHeader
            title="Community Spaces"
            right={voiceRooms.loading ? "Loading…" : spaces.length > 0 ? "See all" : undefined}
            onRight={() => nav.navigate("VoiceRooms")}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 14 }}>
            {voiceRooms.loading ? (
              <View style={{ width: 220, height: 130, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : spaces.length === 0 ? (
              <View style={{ width: 220, height: 130, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="people-outline" size={28} color={colors.muted} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: 8, textAlign: "center" }}>No active spaces{"\n"}Join or create one!</Text>
              </View>
            ) : (
              spaces.map((s) => (
                <SpaceCard key={s.id} space={s} onPress={() => nav.navigate("VoiceRoom", { roomId: s.id })} />
              ))
            )}
          </ScrollView>

          {/* Events / Help cards */}
          <View style={styles.twoCards}>
            <InfoCard
              icon="calendar-outline"
              title="Local Events"
              subtitle="Meetups, camps, schedules"
              accent="brown"
            />
            <InfoCard
              icon="help-buoy-outline"
              title="Help & Safety"
              subtitle="Report, block, guidelines"
              accent="green"
            />
          </View>

          {/* Forum Feed */}
          <SectionHeader title="Forum" right="Filter" />

          {/* Voice post hint + empty state */}
          <View style={{ alignItems: "center", paddingVertical: 30 }}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.muted} />
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.ink, marginTop: 10 }}>No posts yet</Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center", marginTop: 4 }}>
              Tap the mic to share with your community by voice.
            </Text>
          </View>

          <View style={{ height: 26 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function SectionHeader({ title, right, onRight }: { title: string; right?: string; onRight?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? (
        <Pressable style={styles.sectionRightBtn} onPress={onRight}>
          <Text style={styles.sectionRightText}>{right}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SpaceCard({ space, onPress }: { space: Space; onPress: () => void }) {
  const live = space.status === "LIVE";
  return (
    <Pressable style={styles.spaceCard} onPress={onPress}>
      <View style={styles.spaceTop}>
        <View style={[styles.badge, live ? styles.badgeLive : styles.badgeSch]}>
          <Text style={[styles.badgeText, live ? { color: colors.ink } : { color: colors.earth }]}>
            {space.status}
          </Text>
        </View>
        {live && (
          <View style={styles.listenerPill}>
            <Ionicons name="headset-outline" size={12} color={colors.muted} />
            <Text style={styles.listenerText}>{space.listeners}</Text>
          </View>
        )}
      </View>

      <Text style={styles.spaceTitle} numberOfLines={2}>{space.title}</Text>
      <Text style={styles.spaceMeta} numberOfLines={1}>{space.meta}</Text>

      <Pressable style={[styles.joinBtn, live ? styles.joinBtnLive : styles.joinBtnSch]} onPress={onPress}>
        <Text style={[styles.joinText, live ? { color: colors.ink } : { color: colors.earth }]}>
          {live ? "Join" : "Remind me"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function InfoCard({
  icon,
  title,
  subtitle,
  accent,
}: {
  icon: any;
  title: string;
  subtitle: string;
  accent: "green" | "brown";
}) {
  const tint = accent === "green" ? "rgba(19,236,91,0.12)" : "rgba(139,94,60,0.10)";
  const border = accent === "green" ? "rgba(19,236,91,0.22)" : "rgba(139,94,60,0.20)";
  const iconColor = accent === "green" ? colors.primary : colors.earth;

  const handlePress = () => {
    logger.info("CommunityScreen", `InfoCard tapped: ${title}`);
    Alert.alert(title, subtitle);
  };

  return (
    <Pressable style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handlePress}>
      <View style={[styles.infoIcon, { backgroundColor: tint, borderColor: border }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoSub} numberOfLines={2}>{subtitle}</Text>
    </Pressable>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <Pressable style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{post.name[0]}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.postName}>{post.name}</Text>
            {post.verified ? (
              <View style={styles.verifiedPill}>
                <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.postTime}>{post.time}</Text>
        </View>

        <Pressable style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <Text style={styles.postText}>{post.text}</Text>

      <View style={styles.tagRow}>
        {post.tags.map((t) => (
          <View key={t} style={styles.tag}>
            <Text style={styles.tagText}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={styles.postActions}>
        <Action icon="heart-outline" label="Like" />
        <Action icon="chatbox-outline" label="Reply" />
        <Action icon="share-social-outline" label="Share" />
      </View>
    </Pressable>
  );
}

function Action({ icon, label }: { icon: any; label: string }) {
  return (
    <Pressable style={styles.actionBtn}>
      <Ionicons name={icon} size={16} color={colors.earth} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },

  content: { paddingTop: 10, paddingBottom: 16 },

  quickRow: { flexDirection: "row", gap: 10 },
  quickCardPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.20,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  quickPrimaryText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.ink },

  quickCard: {
    width: 92,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  quickText: { fontSize: 11, fontWeight: "800", color: colors.earth },

  sectionHeader: { marginTop: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: colors.ink },
  sectionRightBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.18)" },
  sectionRightText: { fontSize: 11, fontWeight: "900", color: colors.earth, letterSpacing: 0.6 },

  spaceCard: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  spaceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  badgeLive: { backgroundColor: "rgba(19,236,91,0.35)", borderColor: "rgba(19,236,91,0.45)" },
  badgeSch: { backgroundColor: "rgba(139,94,60,0.10)", borderColor: "rgba(139,94,60,0.22)" },
  badgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },

  listenerPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: colors.border },
  listenerText: { fontSize: 10, fontWeight: "900", color: colors.ink },

  spaceTitle: { marginTop: 10, fontSize: 14, fontWeight: "900", color: colors.ink },
  spaceMeta: { marginTop: 6, fontSize: 11, fontWeight: "700", color: colors.muted },

  joinBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 10, alignItems: "center", borderWidth: 1 },
  joinBtnLive: { backgroundColor: colors.primary, borderColor: "rgba(19,236,91,0.35)" },
  joinBtnSch: { backgroundColor: "rgba(139,94,60,0.10)", borderColor: "rgba(139,94,60,0.22)" },
  joinText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },

  twoCards: { marginTop: 12, flexDirection: "row", gap: 10 },
  infoCard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 12 },
  infoIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  infoTitle: { marginTop: 10, fontSize: 13, fontWeight: "900", color: colors.ink },
  infoSub: { marginTop: 4, fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  postCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(19,236,91,0.14)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(19,236,91,0.22)" },
  avatarText: { fontSize: 14, fontWeight: "900", color: colors.ink },

  postName: { fontSize: 13, fontWeight: "900", color: colors.ink },
  postTime: { marginTop: 2, fontSize: 11, fontWeight: "700", color: colors.muted },
  moreBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(19,236,91,0.12)", borderWidth: 1, borderColor: "rgba(19,236,91,0.22)" },
  verifiedText: { fontSize: 10, fontWeight: "900", color: colors.ink },

  postText: { marginTop: 10, fontSize: 12, fontWeight: "700", color: colors.ink, lineHeight: 17 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.22)" },
  tagText: { fontSize: 10, fontWeight: "900", color: colors.earth, letterSpacing: 0.4 },

  postActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: "rgba(139,94,60,0.08)", borderWidth: 1, borderColor: "rgba(139,94,60,0.16)" },
  actionText: { fontSize: 11, fontWeight: "900", color: colors.earth },
});

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  TextInput, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { communityApi, voiceRoomApi } from "../api/community";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { useAlert } from "../components/ui/AlertProvider";

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
  bookmarked?: boolean;
};



const TOPICS = ["agriculture", "health", "education", "finance", "infrastructure", "general", "livestock", "business", "government"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunityScreen() {
  const nav = useNavigation<any>();
  const { showAlert } = useAlert();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Modal states
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showReport, setShowReport] = useState<string | null>(null); // postId or null

  // Form states
  const [roomTitle, setRoomTitle] = useState("");
  const [roomTopic, setRoomTopic] = useState("general");
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postTopic, setPostTopic] = useState("general");
  const [reportReason, setReportReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    console.log("[CRUD:READ] Fetching community spaces and posts...");
    let usedApi = false;
    try {
      const roomRes = await voiceRoomApi.listRooms({ status: "active" });
      if (roomRes.data?.rooms) {
        const mapped: Space[] = roomRes.data.rooms.map((r: any) => ({
          id: r.roomId,
          title: r.title,
          status: "LIVE" as const,
          meta: `${r.participantCount ?? 0} listening • ${(r.topics || []).join(", ") || "Open"}`,
          listeners: r.participantCount ?? 0,
        }));
        console.log(`[CRUD:READ] Fetched ${mapped.length} voice rooms`);
        setSpaces(mapped.length > 0 ? mapped : []);
        usedApi = true;
      }
    } catch (err) { console.log("[CRUD:READ] Error fetching rooms", err); /* fallback */ }

    try {
      const postRes = await communityApi.listPosts({ page: 1, limit: 10 });
      if (postRes.data?.posts) {
        const mapped: Post[] = postRes.data.posts.map((p: any) => ({
          id: p.id,
          name: p.author_name || p.authorName || "Community",
          verified: !!p.is_verified,
          time: p.created_at ? timeAgo(p.created_at) : "recently",
          text: p.content || p.title,
          tags: p.topic ? [p.topic] : [],
          bookmarked: !!p.bookmarked,
        }));
        console.log(`[CRUD:READ] Fetched ${mapped.length} community posts`);
        setPosts(mapped.length > 0 ? mapped : []);
        usedApi = true;
      }
    } catch (err) { console.log("[CRUD:READ] Error fetching posts", err); /* fallback */ }

    setIsLive(usedApi);
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  /* ── CRUD handlers ── */

  const handleCreateRoom = async () => {
    if (roomTitle.trim().length < 3) {
      showAlert({ title: "Error", message: "Room title must be at least 3 characters" });
      return;
    }
    setSubmitting(true);
    console.log(`[ACTION] Attempting to create voice room "${roomTitle}" in topic ${roomTopic}`);
    try {
      const res = await voiceRoomApi.createRoom({ title: roomTitle.trim(), topic: roomTopic });
      if (res.error) {
        console.log("[CRUD:CREATE] Failed to create voice room", res.error);
        showAlert({ title: "Error", message: res.error });
      } else {
        console.log(`[CRUD:CREATE] Successfully created voice room "${roomTitle}"`);
        setShowCreateRoom(false);
        setRoomTitle("");
        setRoomTopic("general");
        await fetchData();
        // Automatically join the newly created room
        nav.navigate("VoiceRoom", { roomId: res.data.roomId });
      }
    } catch (err: any) {
      showAlert({ title: "Error", message: err.message || "Failed to create room" });
    }
    setSubmitting(false);
  };

  const handleCreatePost = async () => {
    if (!postTitle.trim()) {
      showAlert({ title: "Error", message: "Post title is required" });
      return;
    }
    if (!postContent.trim()) {
      showAlert({ title: "Error", message: "Post content is required" });
      return;
    }
    setSubmitting(true);
    console.log(`[ACTION] Attempting to create text post "${postTitle}" in topic ${postTopic}`);
    try {
      const res = await communityApi.createPost({
        title: postTitle.trim(),
        content: postContent.trim(),
        topic: postTopic,
      });
      if (res.error) {
        console.log("[CRUD:CREATE] Failed to create text post", res.error);
        showAlert({ title: "Error", message: res.error });
      } else {
        console.log(`[CRUD:CREATE] Successfully created text post "${postTitle}"`);
        showAlert({ title: "✅ Posted!", message: "Your post is now visible in the forum." });
        setShowCreatePost(false);
        setPostTitle("");
        setPostContent("");
        setPostTopic("general");
        await fetchData();
      }
    } catch (err: any) {
      showAlert({ title: "Error", message: err.message || "Failed to create post" });
    }
    setSubmitting(false);
  };

  const handleBookmark = async (postId: string) => {
    console.log(`[ACTION] Toggling bookmark for post ${postId}`);
    try {
      const res = await communityApi.bookmarkPost(postId);
      if (!res.error) {
        console.log(`[CRUD:UPDATE] Successfully bookmarked post ${postId}`);
        setPosts(prev =>
          prev.map(p => p.id === postId ? { ...p, bookmarked: !p.bookmarked } : p)
        );
      }
    } catch { /* silent */ }
  };

  const handleReport = async () => {
    if (!reportReason.trim() || !showReport) return;
    setSubmitting(true);
    console.log(`[ACTION] Submitting report for post ${showReport}`);
    try {
      const res = await communityApi.reportPost(showReport, reportReason.trim());
      if (!res.error) {
        console.log(`[CRUD:CREATE] Successfully reported post ${showReport}`);
        showAlert({ title: "✅ Reported", message: "Thank you for helping keep the community safe." });
        setShowReport(null);
        setReportReason("");
      } else {
        console.log("[CRUD:CREATE] Failed to report post", res.error);
        showAlert({ title: "Error", message: res.error });
      }
    } catch (err: any) {
      showAlert({ title: "Error", message: err.message || "Failed to report" });
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="menu" size={20} color={colors.ink} />
          </Pressable>

          <Text style={styles.title}>Community</Text>

          <View style={[styles.syncPill, !isLive && styles.syncPillOffline]}>
            <View style={[styles.syncDot, !isLive && styles.syncDotOffline]} />
            <Text style={styles.syncText}>{isLive ? "LIVE" : "OFFLINE"}</Text>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Quick actions */}
          <View style={styles.quickRow}>
            <Pressable style={styles.quickCardPrimary} onPress={() => { console.log("[ACTION] Opened Create Room modal"); setShowCreateRoom(true); }}>
              <Ionicons name="mic" size={18} color={colors.ink} />
              <Text style={styles.quickPrimaryText}>Start Room</Text>
            </Pressable>

            <Pressable style={styles.quickCard} onPress={() => { console.log("[ACTION] Opened Create Post modal"); setShowCreatePost(true); }}>
              <Ionicons name="add-circle-outline" size={18} color={colors.earth} />
              <Text style={styles.quickText}>New Post</Text>
            </Pressable>

            <Pressable style={styles.quickCard} onPress={() => {
              if (posts.length > 0 && posts[0].id !== "p1") {
                setShowReport(posts[0].id);
              } else {
                showAlert({ title: "Info", message: "No posts to report yet." });
              }
            }}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.earth} />
              <Text style={styles.quickText}>Report</Text>
            </Pressable>
          </View>

          {/* Community Spaces */}
          <SectionHeader title="Community Spaces" right="See all" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 14 }}>
            {spaces.map((s) => (
              <SpaceCard
                key={s.id}
                space={s}
                onJoin={async () => {
                  console.log(`[ACTION] Joining Voice Room ${s.id}`);
                  try {
                    await voiceRoomApi.joinRoom(s.id);
                  } catch (err) {
                    console.log("[CRUD:JOIN] Error or already joined", err);
                  }
                  nav.navigate("VoiceRoom", { roomId: s.id });
                }}
              />
            ))}
          </ScrollView>

          {/* Events / Help cards */}
          <View style={styles.twoCards}>
            <InfoCard icon="calendar-outline" title="Local Events" subtitle="Meetups, camps, schedules" accent="brown" />
            <InfoCard icon="help-buoy-outline" title="Help & Safety" subtitle="Report, block, guidelines" accent="green" />
          </View>

          {/* Forum Feed */}
          <SectionHeader title="Forum" right="Filter" />
          <View style={{ gap: 12 }}>
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onBookmark={() => handleBookmark(p.id)}
                onReport={() => setShowReport(p.id)}
              />
            ))}
          </View>

          <View style={{ height: 26 }} />
        </ScrollView>
      </View>

      {/* ═══ Create Voice Room Modal ═══ */}
      <Modal
        visible={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
        title="Start a Voice Room"
        containerStyle={{ padding: 16 }}
      >
        <View style={styles.modernModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Start a Voice Room</Text>
            <Pressable onPress={() => setShowCreateRoom(false)}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>Room Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Water supply discussion"
            placeholderTextColor={colors.muted}
            value={roomTitle}
            onChangeText={setRoomTitle}
          />

          <Text style={styles.inputLabel}>Topic</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
            {TOPICS.map(t => (
              <Pressable
                key={t}
                style={[styles.topicChip, roomTopic === t && styles.topicChipActive]}
                onPress={() => setRoomTopic(t)}
              >
                <Text style={[styles.topicText, roomTopic === t && styles.topicTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Button
            label="CREATE ROOM"
            icon={<Ionicons name="mic" size={18} color={colors.ink} />}
            onPress={handleCreateRoom}
            loading={submitting}
            style={styles.modernSubmitBtn}
          />
        </View>
      </Modal>

      {/* ═══ New Post Modal ═══ */}
      <Modal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        title="New Post"
        containerStyle={{ padding: 16 }}
      >
        <View style={styles.modernModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Post</Text>
            <Pressable onPress={() => setShowCreatePost(false)}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.muted}
            value={postTitle}
            onChangeText={setPostTitle}
          />

          <Text style={styles.inputLabel}>Content</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: "top" }]}
            placeholder="Share knowledge, ask questions, or discuss..."
            placeholderTextColor={colors.muted}
            value={postContent}
            onChangeText={setPostContent}
            multiline
          />

          <Text style={styles.inputLabel}>Topic</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
            {TOPICS.map(t => (
              <Pressable
                key={t}
                style={[styles.topicChip, postTopic === t && styles.topicChipActive]}
                onPress={() => setPostTopic(t)}
              >
                <Text style={[styles.topicText, postTopic === t && styles.topicTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Button
            label="POST"
            icon={<Ionicons name="paper-plane-outline" size={18} color={colors.ink} />}
            onPress={handleCreatePost}
            loading={submitting}
            style={styles.modernSubmitBtn}
          />
        </View>
      </Modal>

      {/* ═══ Report Modal ═══ */}
      <Modal
        visible={showReport !== null}
        onClose={() => { setShowReport(null); setReportReason(""); }}
        title="Report Post"
        containerStyle={{ padding: 16 }}
      >
        <View style={styles.modernModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Post</Text>
            <Pressable onPress={() => { setShowReport(null); setReportReason(""); }}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>Reason</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            placeholder="Why are you reporting this post?"
            placeholderTextColor={colors.muted}
            value={reportReason}
            onChangeText={setReportReason}
            multiline
          />

          <Button
            label="SUBMIT REPORT"
            variant="destructive"
            icon={<Ionicons name="flag-outline" size={18} color="#fff" />}
            onPress={handleReport}
            loading={submitting}
            style={styles.modernSubmitBtn}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? (
        <Pressable style={styles.sectionRightBtn}>
          <Text style={styles.sectionRightText}>{right}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SpaceCard({ space, onJoin }: { space: Space; onJoin: () => void }) {
  const live = space.status === "LIVE";
  return (
    <Pressable style={styles.spaceCard}>
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

      <Pressable style={[styles.joinBtn, live ? styles.joinBtnLive : styles.joinBtnSch]} onPress={onJoin}>
        <Text style={[styles.joinText, live ? { color: colors.ink } : { color: colors.earth }]}>
          {live ? "Join" : "Remind me"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function InfoCard({ icon, title, subtitle, accent }: { icon: any; title: string; subtitle: string; accent: "green" | "brown" }) {
  const tint = accent === "green" ? "rgba(19,236,91,0.12)" : "rgba(139,94,60,0.10)";
  const border = accent === "green" ? "rgba(19,236,91,0.22)" : "rgba(139,94,60,0.20)";
  const iconColor = accent === "green" ? colors.primary : colors.earth;
  return (
    <Pressable style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.infoIcon, { backgroundColor: tint, borderColor: border }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoSub} numberOfLines={2}>{subtitle}</Text>
    </Pressable>
  );
}

function PostCard({ post, onBookmark, onReport }: { post: Post; onBookmark: () => void; onReport: () => void }) {
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
        <Pressable style={styles.moreBtn} onPress={onReport}>
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
        <Pressable style={[styles.actionBtn, post.bookmarked && styles.actionBtnActive]} onPress={onBookmark}>
          <Ionicons name={post.bookmarked ? "heart" : "heart-outline"} size={16} color={post.bookmarked ? colors.primary : colors.earth} />
          <Text style={[styles.actionText, post.bookmarked && { color: colors.primary }]}>
            {post.bookmarked ? "Saved" : "Like"}
          </Text>
        </Pressable>
        <ActionButton icon="chatbox-outline" label="Reply" />
        <ActionButton icon="share-social-outline" label="Share" />
      </View>
    </Pressable>
  );
}

function ActionButton({ icon, label }: { icon: any; label: string }) {
  return (
    <Pressable style={styles.actionBtn}>
      <Ionicons name={icon} size={16} color={colors.earth} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },

  syncPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(19,236,91,0.14)", borderWidth: 1, borderColor: "rgba(19,236,91,0.35)" },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncDotOffline: { backgroundColor: colors.muted },
  syncText: { fontSize: 11, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },
  syncPillOffline: { backgroundColor: "rgba(139,94,60,0.10)", borderColor: "rgba(139,94,60,0.22)" },

  loadingWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  loadingText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  content: { paddingTop: 10, paddingBottom: 16 },

  quickRow: { flexDirection: "row", gap: 10 },
  quickCardPrimary: { flex: 1, backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(19,236,91,0.35)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: colors.primary, shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  quickPrimaryText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.ink },
  quickCard: { width: 92, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 6 },
  quickText: { fontSize: 11, fontWeight: "800", color: colors.earth },

  sectionHeader: { marginTop: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: colors.ink },
  sectionRightBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.18)" },
  sectionRightText: { fontSize: 11, fontWeight: "900", color: colors.earth, letterSpacing: 0.6 },

  spaceCard: { width: 220, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12 },
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
  actionBtnActive: { backgroundColor: "rgba(19,236,91,0.12)", borderColor: "rgba(19,236,91,0.25)" },
  actionText: { fontSize: 11, fontWeight: "900", color: colors.earth },

  /* ── Modern Modal styles ── */
  modernModalContent: {
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.ink
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.earth,
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 16
  },
  topicChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: 'transparent'
  },
  topicChipActive: {
    backgroundColor: colors.primary,
    borderColor: "rgba(19,236,91,0.2)"
  },
  topicText: {
    fontSize: 13,
    fontWeight: "700",
    color: '#6B7280'
  },
  topicTextActive: {
    color: colors.ink
  },
  modernSubmitBtn: {
    marginTop: 12,
    height: 56,
    borderRadius: 16,
  },
});
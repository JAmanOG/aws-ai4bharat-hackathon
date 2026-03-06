import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { communityApi } from "../api/community";

type SavedItem = {
  id: string;
  title: string;
  subtitle: string;
  tag: "Bookmark" | "Scheme" | "Health" | "Market" | "Offline";
};



function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SavedScreen() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchBookmarks = useCallback(async () => {
    console.log("[CRUD:READ] Fetching saved bookmarks");
    try {
      const res = await communityApi.listBookmarks();
      if (res.data?.bookmarks?.length) {
        const mapped: SavedItem[] = res.data.bookmarks.map((b: any) => ({
          id: b.id || b.post_id,
          title: b.title || b.content?.substring(0, 50) || "Bookmarked post",
          subtitle: `Saved ${b.bookmarked_at ? timeAgo(b.bookmarked_at) : "recently"}`,
          tag: "Bookmark" as const,
        }));
        setItems(mapped);
        setIsLive(true);
        console.log(`[CRUD:READ] Successfully fetched ${mapped.length} bookmarks`);
      } else {
        console.log("[CRUD:READ] No bookmarks found in the response.");
      }
    } catch (err) {
      console.log("[CRUD:READ] Error fetching bookmarks:", err);
      // Keep fallback
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Saved</Text>
          <View style={[styles.syncPill, !isLive && styles.syncPillOffline]}>
            <View style={[styles.syncDot, !isLive && styles.syncDotOffline]} />
            <Text style={styles.syncText}>{isLive ? "LIVE" : "LOCAL"}</Text>
          </View>
        </View>

        {/* Offline downloads card */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Offline downloads</Text>
              <Text style={styles.cardSub}>{items.length} items saved</Text>
            </View>
          </View>
          <Pressable style={styles.manageBtn} onPress={() => { console.log("[ACTION] User requested manual refresh of saved items"); fetchBookmarks(); }}>
            <Text style={styles.manageText}>REFRESH</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 30 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, gap: 10 }}
            renderItem={({ item }) => <SavedRow item={item} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function SavedRow({ item }: { item: SavedItem }) {
  return (
    <Pressable style={styles.row} onPress={() => console.log(`[ACTION] Tapped on saved item: ${item.title}`)}>
      <View style={styles.rowLeft}>
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{item.tag.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{item.subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },

  syncPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(19,236,91,0.14)", borderWidth: 1, borderColor: "rgba(19,236,91,0.35)" },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncDotOffline: { backgroundColor: colors.muted },
  syncText: { fontSize: 11, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },
  syncPillOffline: { backgroundColor: "rgba(139,94,60,0.10)", borderColor: "rgba(139,94,60,0.22)" },

  card: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(19,236,91,0.12)", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  cardSub: { marginTop: 2, fontSize: 11, fontWeight: "700", color: colors.muted },
  manageBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.28)" },
  manageText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.earth },

  row: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  tagPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.22)" },
  tagText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6, color: colors.earth },
  rowTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  rowSub: { marginTop: 3, fontSize: 11, fontWeight: "700", color: colors.muted },
});
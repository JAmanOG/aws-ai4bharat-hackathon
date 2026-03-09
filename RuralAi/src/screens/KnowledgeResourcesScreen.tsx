/**
 * KnowledgeResourcesScreen — articles and videos browser for Requirement 7.
 * Opens official sources, YouTube searches, and filtered Google article searches.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  useGovtCourses,
  useKnowledgeResourceSearch,
} from "../hooks/useData";
import { buildKnowledgeContent, type KnowledgeResource } from "../utils/knowledgeResources";
import { useDemoScreenActions } from "../demo/DemoActions";

const palette = {
  bg: "#F5EEDD",
  paper: "#FFF9EF",
  ink: "#1E1710",
  muted: "#6F6457",
  line: "rgba(116, 88, 50, 0.28)",
  gold: "#D5AF52",
  goldDark: "#B78D32",
  goldSoft: "rgba(213,175,82,0.18)",
};

type TabKey = "all" | "videos" | "articles";

export default function KnowledgeResourcesScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const initialTab = normalizeTab(route.params?.initialTab);
  const initialQuery = normalizeQuery(route.params?.query);
  const initialLanguage = normalizeLanguage(route.params?.language);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [queryInput, setQueryInput] = useState<string>(initialQuery);
  const [query, setQuery] = useState<string>(initialQuery);
  const [language, setLanguage] = useState<string>(initialLanguage);
  const govtCourses = useGovtCourses();
  const govtList = (govtCourses.data as any)?.courses ?? [];
  const liveResults = useKnowledgeResourceSearch(query, language, 6);

  useEffect(() => {
    const nextTab = normalizeTab(route.params?.initialTab);
    const nextQuery = normalizeQuery(route.params?.query);
    const nextLanguage = normalizeLanguage(route.params?.language);

    setTab(nextTab);
    setQueryInput(nextQuery);
    setQuery(nextQuery);
    setLanguage(nextLanguage);
  }, [route.params?.initialTab, route.params?.query, route.params?.language]);

  const demoActions = useMemo(
    () => ({
      showAll: () => setTab("all"),
      showVideos: () => setTab("videos"),
      showArticles: () => setTab("articles"),
      updateSearch: (payload?: Record<string, any>) => {
        const nextQuery = normalizeQuery(payload?.query);
        const nextLanguage = normalizeLanguage(payload?.language);
        if (!nextQuery) return;
        setQueryInput(nextQuery);
        setQuery(nextQuery);
        setLanguage(nextLanguage);
      },
    }),
    [],
  );

  useDemoScreenActions("KnowledgeResources", demoActions);

  const content = useMemo(
    () =>
      buildKnowledgeContent({
        govtCourses: govtList,
        externalSearch: liveResults.data,
        strictRealDataOnly: true,
      }),
    [govtList, liveResults.data],
  );

  const openResource = async (resource: KnowledgeResource) => {
    try {
      await Linking.openURL(resource.url);
    } catch {
      Alert.alert("Unable to open source", "Please try again in a moment.");
    }
  };

  const showOfficial = tab === "all";
  const showVideos = tab === "all" || tab === "videos";
  const showArticles = tab === "all" || tab === "articles";
  const showLiveStreams = showVideos;
  const handleBack = () => {
    if (nav.canGoBack()) {
      nav.goBack();
      return;
    }
    nav.navigate("KnowledgeDashboard");
  };

  const applySearch = () => {
    const next = normalizeQuery(queryInput);
    if (!next) return;
    setQuery(next);
    setQueryInput(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={palette.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Courses & Articles</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color={palette.muted} />
            <TextInput
              style={styles.searchInput}
              value={queryInput}
              onChangeText={setQueryInput}
              placeholder="Search learning topic"
              placeholderTextColor={palette.muted}
              returnKeyType="search"
              onSubmitEditing={applySearch}
            />
          </View>
          <Pressable style={styles.searchBtn} onPress={applySearch}>
            <Text style={styles.searchBtnText}>Go</Text>
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <FilterTab label="All" active={tab === "all"} onPress={() => setTab("all")} />
          <FilterTab label="Videos" active={tab === "videos"} onPress={() => setTab("videos")} />
          <FilterTab label="Articles" active={tab === "articles"} onPress={() => setTab("articles")} />
        </View>

        {showOfficial ? (
          <>
            <Text style={styles.sectionTitle}>Official Training Sources</Text>
            {govtCourses.loading ? <LoadingStrip text="Loading official training sources..." /> : null}
            {content.featuredSources.length > 0 ? (
              <View style={styles.stack}>
                {content.featuredSources.slice(0, 3).map((item) => (
                  <ResourceCard
                    key={item.id}
                    resource={item}
                    icon="school-outline"
                    sourceBadge={item.tag ?? "Govt"}
                    onPress={() => openResource(item)}
                  />
                ))}
              </View>
            ) : (
              <EmptyStateCard
                title="No official sources available"
                subtitle="Government training links are not available right now."
              />
            )}
          </>
        ) : null}

        {showLiveStreams ? (
          <>
            <Text style={styles.sectionTitle}>Live Streams</Text>
            {liveResults.loading ? <LoadingStrip text="Checking live YouTube sessions..." /> : null}
            {content.liveFallback.length > 0 ? (
              <View style={styles.stack}>
                {content.liveFallback.slice(0, 3).map((item) => (
                  <ResourceCard
                    key={item.id}
                    resource={item}
                    icon="radio-outline"
                    sourceBadge="LIVE"
                    onPress={() => openResource(item)}
                  />
                ))}
              </View>
            ) : liveResults.loading ? null : (
              <EmptyStateCard
                title={liveResults.error ? "Live streams unavailable" : "No live streams found"}
                subtitle={liveResults.error ? "Could not fetch live results. Try again in a moment." : `No active livestreams matched "${query}". This screen only shows real live sessions.`}
                onPress={liveResults.refresh}
                actionLabel={liveResults.error ? "Try Again" : undefined}
              />
            )}
          </>
        ) : null}

        {showVideos ? (
          <>
            <Text style={styles.sectionTitle}>Recommended YouTube Videos</Text>
            {liveResults.loading ? <LoadingStrip text="Searching live videos..." /> : null}
            {content.videoResources.length > 0 ? (
              <View style={styles.stack}>
                {content.videoResources.slice(0, 4).map((item) => (
                  <ResourceCard
                    key={item.id}
                    resource={item}
                    icon="logo-youtube"
                    sourceBadge="YouTube"
                    onPress={() => openResource(item)}
                  />
                ))}
              </View>
            ) : liveResults.loading ? null : (
              <EmptyStateCard
                title={liveResults.error ? "Videos unavailable" : "No videos found"}
                subtitle={liveResults.error ? "Could not fetch video results. Try again in a moment." : `No YouTube videos matched "${query}". Only real search results are shown here.`}
                onPress={liveResults.refresh}
                actionLabel={liveResults.error ? "Try Again" : undefined}
              />
            )}
          </>
        ) : null}

        {showArticles ? (
          <>
            <Text style={styles.sectionTitle}>Web Articles</Text>
            {liveResults.loading ? <LoadingStrip text="Finding article sources..." /> : null}
            {content.articleResources.length > 0 ? (
              <View style={styles.stack}>
                {content.articleResources.slice(0, 4).map((item) => (
                  <ResourceCard
                    key={item.id}
                    resource={item}
                    icon="logo-google"
                    sourceBadge="Google"
                    onPress={() => openResource(item)}
                  />
                ))}
              </View>
            ) : liveResults.loading ? null : (
              <EmptyStateCard
                title={liveResults.error ? "Articles unavailable" : "No articles found"}
                subtitle={liveResults.error ? "Could not fetch article sources. Try again in a moment." : `No article sources matched "${query}". Only real article links are shown here.`}
                onPress={liveResults.refresh}
                actionLabel={liveResults.error ? "Try Again" : undefined}
              />
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function normalizeQuery(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeLanguage(value: unknown): string {
  const normalized = String(value ?? "hi").trim();
  return normalized || "hi";
}

function normalizeTab(value: unknown): TabKey {
  if (value === "videos" || value === "articles" || value === "all") {
    return value;
  }
  return "all";
}

function FilterTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterTab, active && styles.filterTabActive]} onPress={onPress}>
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LoadingStrip({ text }: { text: string }) {
  return (
    <View style={styles.loadingStrip}>
      <Ionicons name="sparkles" size={15} color={palette.goldDark} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

function EmptyStateCard({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="search-outline" size={24} color={palette.goldDark} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {actionLabel && onPress ? (
        <Pressable style={styles.emptyBtn} onPress={onPress}>
          <Text style={styles.emptyBtnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ResourceCard({
  resource,
  icon,
  sourceBadge,
  onPress,
}: {
  resource: KnowledgeResource;
  icon: any;
  sourceBadge: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.thumb}>
        {resource.thumbnail ? (
          <Image source={{ uri: resource.thumbnail }} style={styles.thumbImage} resizeMode="cover" />
        ) : null}
        <View style={styles.sourceMark}>
          <Ionicons
            name={icon}
            size={18}
            color={sourceBadge === "Google" ? palette.goldDark : sourceBadge === "LIVE" ? palette.goldDark : "#D32F2F"}
          />
        </View>
        <View style={styles.thumbOverlay}>
          <Ionicons name={icon} size={32} color={palette.goldDark} />
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{resource.title}</Text>
        <Text style={styles.cardSub} numberOfLines={2}>{resource.subtitle}</Text>
        {resource.meta ? <Text style={styles.cardMeta} numberOfLines={1}>{resource.meta}</Text> : null}
        <Pressable style={styles.cardBtn} onPress={onPress}>
          <Text style={styles.cardBtnText}>{resource.ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 19, fontWeight: "900", color: palette.ink },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  searchRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 16 },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: palette.ink },
  searchBtn: {
    borderRadius: 18,
    backgroundColor: palette.gold,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: { fontSize: 14, fontWeight: "900", color: "#fff" },
  tabRow: { flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 20 },
  filterTab: {
    minWidth: 88,
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  filterTabActive: { backgroundColor: palette.gold, borderColor: palette.goldDark },
  filterTabText: { fontSize: 14, fontWeight: "700", color: palette.muted },
  filterTabTextActive: { color: palette.paper },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: palette.ink, marginBottom: 14, marginTop: 8 },
  loadingStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.goldSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  loadingText: { fontSize: 12, fontWeight: "700", color: palette.ink },
  stack: { gap: 14, marginBottom: 18 },
  emptyCard: {
    alignItems: "center",
    backgroundColor: palette.paper,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 18,
    paddingVertical: 22,
    marginBottom: 18,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "900",
    color: palette.ink,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: palette.muted,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: palette.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyBtnText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  thumb: {
    width: 110,
    height: 110,
    borderRadius: 22,
    backgroundColor: palette.goldSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { ...StyleSheet.absoluteFillObject },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,249,239,0.18)",
  },
  sourceMark: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "900", color: palette.ink, lineHeight: 22 },
  cardSub: { marginTop: 6, fontSize: 12, fontWeight: "600", color: palette.muted, lineHeight: 17 },
  cardMeta: { marginTop: 6, fontSize: 11, fontWeight: "700", color: palette.goldDark },
  cardBtn: {
    marginTop: 16,
    alignSelf: "flex-start",
    minWidth: 170,
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#E7C76C",
    paddingVertical: 12,
    paddingHorizontal: 18,
    shadowColor: "#D0A841",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardBtnText: { fontSize: 14, fontWeight: "900", color: palette.ink },
});

import React from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useNavigation } from "@react-navigation/native";
import { useVoiceSessions, useSchemes, usePriceAlerts } from "../hooks/useData";

type SavedItem = {
  id: string;
  title: string;
  subtitle: string;
  tag: "Session" | "Scheme" | "Alert" | "Offline";
};

export default function SavedScreen() {
  const nav = useNavigation<any>();
  const sessions = useVoiceSessions(5);
  const schemes = useSchemes();
  const alerts = usePriceAlerts();

  /* Build items from real API data */
  const items: SavedItem[] = React.useMemo(() => {
    const result: SavedItem[] = [];

    // Voice sessions
    const sessionList = (sessions.data as any)?.sessions ?? [];
    sessionList.slice(0, 3).forEach((s: any) => {
      result.push({
        id: `session_${s.session_id ?? s.id}`,
        title: s.title ?? `Voice session`,
        subtitle: s.created_at ? `${new Date(s.created_at).toLocaleDateString()}` : "Recent",
        tag: "Session",
      });
    });

    // Schemes as saved items
    const schemeList = (schemes.data as any)?.schemes ?? [];
    schemeList.slice(0, 2).forEach((s: any) => {
      result.push({
        id: `scheme_${s.id}`,
        title: s.name,
        subtitle: s.summary ?? s.benefit_summary ?? "",
        tag: "Scheme",
      });
    });

    // Price alerts as saved items
    const alertList = (alerts.data as any)?.alerts ?? [];
    alertList.slice(0, 2).forEach((a: any) => {
      result.push({
        id: `alert_${a.alert_id}`,
        title: `${a.crop_type} price alert`,
        subtitle: a.target_price ? `Target: ₹${a.target_price}` : (a.direction ?? "Active"),
        tag: "Alert",
      });
    });

    // Fallback
    if (result.length === 0) {
      result.push(
        { id: "1", title: "PM-Kisan Application Steps", subtitle: "Saved yesterday • Hindi", tag: "Scheme" },
        { id: "2", title: "Wheat price alert", subtitle: "Active • ₹2,500 target", tag: "Alert" },
      );
    }

    return result;
  }, [sessions.data, schemes.data, alerts.data]);

  const loading = sessions.loading || schemes.loading || alerts.loading;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Saved</Text>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="options-outline" size={20} color={colors.ink} />
          </Pressable>
        </View>

        {/* Offline downloads card */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Offline downloads</Text>
              <Text style={styles.cardSub}>{items.length} items available</Text>
            </View>
          </View>

          <Pressable style={styles.manageBtn} onPress={() => nav.navigate("SyncStatus")}>
            <Text style={styles.manageText}>MANAGE</Text>
          </Pressable>
        </View>

        {/* List */}
        {loading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, gap: 10 }}
            renderItem={({ item }) => (
              <SavedRow
                item={item}
                onPress={() => nav.navigate("SavedDetail", { itemId: item.id })}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function SavedRow({ item, onPress }: { item: SavedItem; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{item.tag.toUpperCase()}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {item.subtitle}
          </Text>
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
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  card: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(19,236,91,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  cardSub: { marginTop: 2, fontSize: 11, fontWeight: "700", color: colors.muted },

  manageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.28)",
  },
  manageText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.earth },

  row: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
  },
  tagText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6, color: colors.earth },

  rowTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  rowSub: { marginTop: 3, fontSize: 11, fontWeight: "700", color: colors.muted },
});
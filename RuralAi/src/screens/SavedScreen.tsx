import React from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
<<<<<<< HEAD
import { useNavigation } from "@react-navigation/native";
=======
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0

type SavedItem = {
  id: string;
  title: string;
  subtitle: string;
  tag: "Offline" | "Scheme" | "Health" | "Market";
};

const DATA: SavedItem[] = [
  { id: "1", title: "PM-Kisan Application Steps", subtitle: "Saved yesterday • Hindi", tag: "Scheme" },
  { id: "2", title: "Wheat price in nearby mandi", subtitle: "Saved today • Marathi", tag: "Market" },
  { id: "3", title: "Fever + cough guidance", subtitle: "Saved 2 days ago • English", tag: "Health" },
  { id: "4", title: "Offline basics: crop calendar", subtitle: "Downloaded • Available offline", tag: "Offline" },
];

export default function SavedScreen() {
<<<<<<< HEAD
  const nav = useNavigation<any>();

=======
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
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
<<<<<<< HEAD
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
=======
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Offline downloads</Text>
              <Text style={styles.cardSub}>3 items available offline</Text>
            </View>
          </View>
<<<<<<< HEAD

=======
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
          <Pressable style={styles.manageBtn}>
            <Text style={styles.manageText}>MANAGE</Text>
          </Pressable>
        </View>

        {/* List */}
        <FlatList
          data={DATA}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, gap: 10 }}
<<<<<<< HEAD
          renderItem={({ item }) => (
            <SavedRow
              item={item}
              onPress={() => nav.navigate("SavedDetail", { itemId: item.id })}
            />
          )}
=======
          renderItem={({ item }) => <SavedRow item={item} />}
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

<<<<<<< HEAD
function SavedRow({ item, onPress }: { item: SavedItem; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
=======
function SavedRow({ item }: { item: SavedItem }) {
  return (
    <Pressable style={styles.row}>
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
      <View style={styles.rowLeft}>
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{item.tag.toUpperCase()}</Text>
        </View>
<<<<<<< HEAD

        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
      </View>

=======
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{item.subtitle}</Text>
        </View>
      </View>
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
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
<<<<<<< HEAD
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(19,236,91,0.12)",
    alignItems: "center",
    justifyContent: "center",
=======
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(19,236,91,0.12)",
    alignItems: "center", justifyContent: "center",
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
  },
  cardTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  cardSub: { marginTop: 2, fontSize: 11, fontWeight: "700", color: colors.muted },

  manageBtn: {
<<<<<<< HEAD
    paddingHorizontal: 12,
    paddingVertical: 8,
=======
    paddingHorizontal: 12, paddingVertical: 8,
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
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
<<<<<<< HEAD
    gap: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

=======
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
  },
  tagText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6, color: colors.earth },
<<<<<<< HEAD

=======
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
  rowTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  rowSub: { marginTop: 3, fontSize: 11, fontWeight: "700", color: colors.muted },
});
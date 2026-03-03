import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { LinearGradient } from "expo-linear-gradient";

type Tile = {
  label: string;
  icon: any;
  moduleKey: string;
};

export default function HomeScreen() {
  const nav = useNavigation<any>();

  // demo offline toggle (long press top bar)
  const [offline, setOffline] = useState(false);

  const tiles = [
    {
      label: "Agriculture",
      sub: "कृषि",
      icon: "leaf-outline",
      moduleKey: "AGRICULTURE",
      accent: colors.primary,
    },
    {
      label: "Knowledge",
      sub: "ज्ञान",
      icon: "book-outline",
      moduleKey: "EDUCATION",
      accent: colors.primary,
    },
    {
      label: "Economics",
      sub: "अर्थव्यवस्था",
      icon: "cash-outline",
      moduleKey: "FINANCE",
      accent: colors.primary,
    },
    {
      label: "Health",
      sub: "स्वास्थ्य",
      icon: "medkit-outline",
      moduleKey: "HEALTH",
      accent: colors.primary,
    },
    {
      label: "Infrastructure",
      sub: "बुनियादी ढांचा",
      icon: "home-outline",
      moduleKey: "INFRASTRUCTURE",
      accent: colors.primary,
      wide: true,
    },
  ];

  const goAsk = () => {
    const parent = nav.getParent();
    if (parent) parent.navigate("Ask");
    else nav.navigate("Ask");
  };

  const openModule = (moduleKey: string) => {
    nav.navigate("Module", { title: moduleKey });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Top status bar (Offline / Synced) */}
          <Pressable
            style={styles.topStatus}
            onLongPress={() => setOffline((v) => !v)}
            delayLongPress={500}
          >
            <View style={styles.statusLeft}>
              <Ionicons
                name={offline ? "cloud-offline-outline" : "cloud-done-outline"}
                size={16}
                color={offline ? colors.earth : colors.primary}
              />
              <Text style={styles.statusTitle}>{offline ? "Offline" : "Synced"}</Text>
            </View>
            <Text style={styles.statusSub}>
              {offline ? "Offline Mode - Sync Pending" : "Online - Data up to date"}
            </Text>
          </Pressable>

          {/* Title */}
          <Text style={styles.mainTitle}>RURAL ECOSYSTEM PLATFORM</Text>

          {/* Mic + waveform area */}
          <View style={styles.micRow}>
            <WaveSide side="left" />
            <Pressable style={styles.micWrap} onPress={goAsk} android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: true }}>
              <View style={styles.ringOuter} />
              <View style={styles.ringMid} />
              <View style={styles.micCore}>
                <Ionicons name="mic" size={34} color={colors.surface} />
              </View>
            </Pressable>
            <WaveSide side="left" />
          </View>

          <Text style={styles.tapTitle}>Tap to Speak</Text>
          <Text style={styles.example} numberOfLines={1}>
            Example: Ask about crop prices in Hindi…
          </Text>

          {/* Tiles (2x2 + 1 wide) */}
          <View style={styles.tilesWrap}>
            {tiles.map((t) => (
              <CategoryCard
                key={t.label}
                title={t.label}
                subtitle={t.sub}
                icon={t.icon}
                wide={t.wide}
                onPress={() => openModule(t.moduleKey)}
                onMicPress={goAsk}   // mic press opens Ask tab
              />
            ))}
          </View>


        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WaveSide({ side }: { side: "left" | "right" }) {
  const bars = [8, 16, 24, 16, 10, 18, 12];
  return (
    <View style={[styles.wave, side === "left" ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
      {bars.map((h, i) => (
        <View key={i} style={[styles.waveBar, { height: h, opacity: 0.35 + (i % 3) * 0.15 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingTop: 10 },

  topStatus: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusTitle: { fontSize: 12, fontWeight: "900", color: colors.ink },
  statusSub: { marginTop: 4, fontSize: 11, fontWeight: "700", color: colors.muted },

  mainTitle: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.ink,
  },

  micRow: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },

  wave: { width: 78, flexDirection: "row", gap: 4, justifyContent: "center" },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: colors.primary },

  micWrap: { width: 190, height: 190, alignItems: "center", justifyContent: "center" },
  ringOuter: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(19,236,91,0.10)",
  },
  ringMid: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(19,236,91,0.18)",
  },
  micCore: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  tapTitle: { marginTop: 6, textAlign: "center", fontSize: 22, fontWeight: "900", color: colors.ink },
  example: { marginTop: 6, textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.muted },

  // tilesWrap: {
  //   marginTop: 18,
  //   flexDirection: "row",
  //   flexWrap: "wrap",
  //   justifyContent: "space-between",
  //   rowGap: 12,
  // },
  tile: {
    width: "31%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
    gap: 10,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(19,236,91,0.10)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { fontSize: 11, fontWeight: "900", color: colors.ink },

  // make last row (2 tiles) look centered by widening them a bit
  // (RN doesn't know "last row", so this is okay visually as is; optional tweak below)

  userPill: {
    position: "absolute",
    right: 16,
    bottom: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(19,236,91,0.14)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: { fontSize: 10, fontWeight: "900", color: colors.ink },

  tilesWrap: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  card: {
    backgroundColor: colors.ink,      // dark premium card like reference
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.18)",
    overflow: "hidden",
  },

  cardHalf: { width: "48%" },
  cardWide: { width: "100%" },

  hero: {
    height: 88,
    position: "relative",
  },

  heroTop: {
    paddingHorizontal: 12,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  heroIconPill: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  micMini: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(19,236,91,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroShine: {
    position: "absolute",
    right: -30,
    bottom: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  cardBody: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  cardTitle: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },

  cardSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "800",
  },
});

function CategoryCard({
  title,
  subtitle,
  icon,
  wide,
  onPress,
  onMicPress,
}: {
  title: string;
  subtitle: string;
  icon: any;
  wide?: boolean;
  onPress: () => void;
  onMicPress: () => void;
}) {
  return (
    <Pressable style={[styles.card, wide ? styles.cardWide : styles.cardHalf]} onPress={onPress}>
      {/* Hero / image-like area */}
      <LinearGradient
        colors={["rgba(19,236,91,0.18)", "rgba(17,24,19,0.92)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* top row: icon + mic */}
        <View style={styles.heroTop}>
          <View style={styles.heroIconPill}>
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>

          <Pressable onPress={onMicPress} style={styles.micMini} hitSlop={10}>
            <Ionicons name="mic" size={14} color={colors.ink} />
          </Pressable>
        </View>

        {/* decorative “photo” shine */}
        <View style={styles.heroShine} />
      </LinearGradient>

      {/* labels */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}
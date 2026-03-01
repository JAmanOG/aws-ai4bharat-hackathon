import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";

export default function AskScreen() {
  const nav = useNavigation<any>();
  const [listening, setListening] = useState(false);

  const openCommunity = () => {
    // stack screen "Community" is in RootNavigator (Stack)
    nav.navigate("Community");
  };

  const openProfile = () => {
    nav.navigate("Profile"); // tab route
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="menu" size={22} color={colors.ink} />
          </Pressable>

          <Text style={styles.headerTitle}>Assistant</Text>

          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable style={styles.iconBtn} onPress={openCommunity}>
              <Ionicons name="people-outline" size={22} color={colors.ink} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={openProfile}>
              <Ionicons name="person-outline" size={22} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        {/* Center Logo Glow */}
        <View style={styles.center}>
          <View style={styles.logoWrap}>
            <View style={styles.ringOuter} />
            <View style={styles.ringMid} />
            <View style={styles.logoCore}>
              <Ionicons name="leaf" size={34} color={colors.primary} />  
            </View>
          </View>

          {/* Text like your inspiration */}
          <View style={styles.promptRow}>
            
            <Text style={styles.promptText}> नमस्ते, how can I help you?</Text>
          </View>

          <Text style={styles.helper}>
            Tap the glowing button below to speak. I can help with farming tips, market prices, and weather.
          </Text>
        </View>

        {/* Optional: big CTA button (matches “glowing button below”) */}
        <Pressable style={styles.speakBtn} onPress={() => setListening(true)}>
          <Ionicons name="mic" size={22} color={colors.ink} />
          <Text style={styles.speakText}>Tap to Speak</Text>
        </Pressable>

        {/* Listening Overlay */}
        <ListeningOverlay
          visible={listening}
          onCancel={() => setListening(false)}
          onFakeSubmit={() => setListening(false)}
        />
      </View>
    </SafeAreaView>
  );
}

function ListeningOverlay({
  visible,
  onCancel,
  onFakeSubmit,
}: {
  visible: boolean;
  onCancel: () => void;
  onFakeSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.listenCard}>
          <View style={styles.listenRings}>
            <View style={styles.listenRingOuter} />
            <View style={styles.listenRingMid} />
            <View style={styles.listenCore}>
              <Ionicons name="mic" size={34} color={colors.surface} />
            </View>
          </View>

          <Text style={styles.listenTitle}>Listening…</Text>
          <Text style={styles.listenSub}>Speak now</Text>

          <Pressable style={styles.fakeBtn} onPress={onFakeSubmit}>
            <Text style={styles.fakeBtnText}>Demo: submit</Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "900", color: colors.ink },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  logoWrap: { width: 190, height: 190, alignItems: "center", justifyContent: "center" },
  ringOuter: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(19,236,91,0.10)" },
  ringMid: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(19,236,91,0.18)" },
  logoCore: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.25)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  logoImg: { width: 56, height: 56 },

  promptRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  bars: { flexDirection: "row", gap: 3 },
  bar: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.ink, opacity: 0.6 },
  promptText: { fontSize: 14, fontWeight: "900", color: colors.ink },

  helper: { marginTop: 10, fontSize: 12, fontWeight: "700", color: colors.muted, textAlign: "center", lineHeight: 17 },

  speakBtn: {
    marginBottom: 16,
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  speakText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.ink },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center", padding: 18 },
  listenCard: { width: "100%", backgroundColor: colors.bg, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, alignItems: "center" },
  listenRings: { width: 190, height: 190, alignItems: "center", justifyContent: "center", marginTop: 6 },
  listenRingOuter: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(19,236,91,0.10)" },
  listenRingMid: { position: "absolute", width: 135, height: 135, borderRadius: 67.5, backgroundColor: "rgba(19,236,91,0.18)" },
  listenCore: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", elevation: 5 },
  listenTitle: { marginTop: 10, fontSize: 22, fontWeight: "900", color: colors.ink },
  listenSub: { marginTop: 6, fontSize: 12, fontWeight: "700", color: colors.muted },

  fakeBtn: { marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.22)" },
  fakeBtnText: { fontSize: 12, fontWeight: "900", color: colors.earth },

  cancelBtn: { marginTop: 12, width: "100%", backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  cancelText: { fontSize: 13, fontWeight: "900", color: colors.ink },
});
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useMemoryFacts, useHealthCheck } from "../hooks/useData";

export default function ProfileScreen() {
  const [lowData, setLowData] = useState(true);
  const [offlineCache, setOfflineCache] = useState(true);
  const [tts, setTts] = useState(true);

  const [shareLocation, setShareLocation] = useState(false);
  const [shareFarming, setShareFarming] = useState(true);
  const [shareHealth, setShareHealth] = useState(false);
  const [shareLearning, setShareLearning] = useState(true);

  const memoryFacts = useMemoryFacts();
  const health = useHealthCheck();
  const synced = !health.error;

  /* Derive profile info from memory facts if available */
  const facts = (memoryFacts.data as any)?.facts ?? [];
  const getName = () => {
    const f = facts.find((f: any) => f.factKey === "user_name");
    return f?.factValue ?? "User";
  };
  const getLocation = () => {
    const state = facts.find((f: any) => f.factKey === "location_state")?.factValue;
    const lang = facts.find((f: any) => f.factKey === "preferred_language")?.factValue;
    const parts = [lang, state].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Set up your profile via voice";
  };
  const getInitial = () => {
    const name = getName();
    return name[0]?.toUpperCase() ?? "U";
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={colors.ink} />
          </Pressable>

          <Text style={styles.title}>Profile</Text>

          <View style={styles.syncPill}>
            <View style={[styles.syncDot, !synced && { backgroundColor: colors.muted }]} />
            <Text style={styles.syncText}>{synced ? "SYNCED" : "OFFLINE"}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile card */}
          <View style={styles.profileCard}>
            {memoryFacts.loading ? (
              <ActivityIndicator color={colors.primary} style={{ flex: 1, paddingVertical: 10 }} />
            ) : (
              <>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitial()}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{getName()}</Text>
                  <Text style={styles.sub}>{getLocation()}</Text>

              <View style={styles.badgesRow}>
                <View style={styles.badge}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                  <Text style={styles.badgeText}>Verified</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: "rgba(139,94,60,0.10)", borderColor: "rgba(139,94,60,0.22)" }]}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={colors.earth} />
                  <Text style={[styles.badgeText, { color: colors.earth }]}>Privacy</Text>
                </View>
              </View>
            </View>

            <Pressable style={styles.editBtn}>
              <Text style={styles.editText}>EDIT</Text>
            </Pressable>
              </>
            )}
          </View>

          {/* Preferences */}
          <SectionHeader title="Preferences" />
          <Card>
            <RowLink icon="language-outline" title="Language" subtitle="Hindi (Default)" />
            <Divider />
            <RowLink icon="mic-outline" title="Voice Settings" subtitle="Mic, speech, clarity" />
            <Divider />
            <RowToggle
              icon="volume-high-outline"
              title="Voice responses (TTS)"
              subtitle="Read answers aloud"
              value={tts}
              onChange={setTts}
            />
          </Card>

          {/* Connectivity */}
          <SectionHeader title="Connectivity" />
          <Card>
            <RowToggle
              icon="speedometer-outline"
              title="Low Data Mode"
              subtitle="Use less data on 2G/3G"
              value={lowData}
              onChange={setLowData}
            />
            <Divider />
            <RowToggle
              icon="cloud-download-outline"
              title="Offline Cache"
              subtitle="Save important info for offline"
              value={offlineCache}
              onChange={setOfflineCache}
            />
            <Divider />
            <RowLink icon="download-outline" title="Offline Downloads" subtitle="Manage saved items" />
          </Card>

          {/* Data & Privacy */}
          <SectionHeader title="Data & Privacy" />
          <Card>
            <RowToggle
              icon="location-outline"
              title="Share Location"
              subtitle="For nearby services"
              value={shareLocation}
              onChange={setShareLocation}
            />
            <Divider />
            <RowToggle
              icon="leaf-outline"
              title="Share Farming Data"
              subtitle="Crop info for better advice"
              value={shareFarming}
              onChange={setShareFarming}
            />
            <Divider />
            <RowToggle
              icon="medkit-outline"
              title="Share Health Info"
              subtitle="Only for health features"
              value={shareHealth}
              onChange={setShareHealth}
            />
            <Divider />
            <RowToggle
              icon="school-outline"
              title="Share Learning Progress"
              subtitle="Personalized learning"
              value={shareLearning}
              onChange={setShareLearning}
            />
            <Divider />
            <RowLink icon="time-outline" title="Sharing History" subtitle="See what was shared" />
            <Divider />
            <RowLink icon="lock-closed-outline" title="Revoke Access" subtitle="Disable sharing anytime" danger />
          </Card>

          {/* Support */}
          <SectionHeader title="Support" />
          <Card>
            <RowLink icon="help-circle-outline" title="Help & FAQ" subtitle="Common questions" />
            <Divider />
            <RowLink icon="chatbox-ellipses-outline" title="Feedback" subtitle="Tell us what to improve" />
            <Divider />
            <RowLink icon="warning-outline" title="Report a Problem" subtitle="Safety & issues" danger />
          </Card>

          <View style={{ height: 28 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* ---------- Small components ---------- */

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function RowLink({
  icon,
  title,
  subtitle,
  danger,
}: {
  icon: any;
  title: string;
  subtitle: string;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={[styles.rowIconNormal, danger ? styles.rowIconDanger : styles.rowIconNormal]}>
          <Ionicons name={icon} size={18} color={danger ? "#B91C1C" : colors.earth} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, danger && { color: "#B91C1C" }]}>{title}</Text>
          <Text style={styles.rowSub}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function RowToggle({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: any;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconNormal}>
          <Ionicons name={icon} size={18} color={colors.earth} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{subtitle}</Text>
        </View> 
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? colors.primary : "#F3F4F6"}
        trackColor={{ false: "#E5E7EB", true: "rgba(19,236,91,0.35)" }}
      />
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },

  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(19,236,91,0.14)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncText: { fontSize: 11, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },

  content: { paddingTop: 10, paddingBottom: 16 },

  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(19,236,91,0.14)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "900", color: colors.ink },

  name: { fontSize: 14, fontWeight: "900", color: colors.ink },
  sub: { marginTop: 4, fontSize: 11, fontWeight: "700", color: colors.muted },

  badgesRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(19,236,91,0.12)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.22)",
  },
  badgeText: { fontSize: 10, fontWeight: "900", color: colors.ink, letterSpacing: 0.4 },

  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
  },
  editText: { fontSize: 11, fontWeight: "900", color: colors.earth, letterSpacing: 1 },

  sectionHeader: { marginTop: 14, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: colors.ink },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  divider: { height: 1, backgroundColor: colors.border },

  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

  rowIconNormal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(185,28,28,0.10)",
    borderWidth: 1,
    borderColor: "rgba(185,28,28,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  rowTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  rowSub: { marginTop: 3, fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 },
});
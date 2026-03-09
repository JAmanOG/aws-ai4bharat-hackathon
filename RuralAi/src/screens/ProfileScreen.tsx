import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useMemoryFacts } from "../hooks/useData";
import { APP_LANGUAGES, normalizeAppLanguage } from "../utils/languagePreference";
import { authApi } from "../services/api";
import { useVoice } from "../voice/VoiceContext";
import { logger } from "../utils/logger";

const PALETTE = {
  screen: "#E9E6F3",
  hero: "#EFDCA6",
  heroShadow: "rgba(135, 111, 52, 0.12)",
  card: "#FFFFFF",
  line: "#DDD9E7",
  ink: "#16120F",
  muted: "#6D655A",
  soft: "#9B9388",
  iconBg: "#F5E4AC",
  iconStroke: "#E7D398",
  successBg: "#D8E9D8",
  successInk: "#4A7450",
  privacyBg: "#E8C7A9",
  privacyInk: "#69452F",
  avatarBg: "#A8D09D",
  avatarRing: "#D9DDD0",
  toggleOn: "#D9BE64",
  toggleOff: "#E0DCD4",
  shadow: "rgba(38, 27, 17, 0.08)",
  logoutBg: "#F6E4A9",
  logoutInk: "#6A1612",
};

type FactRecord = Record<string, string>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const {
    language,
    setLanguage,
    ttsEnabled,
    setTtsEnabled,
    lowDataMode,
    setLowDataMode,
    clearHistory,
    setSessionId,
  } = useVoice();
  const memoryFacts = useMemoryFacts();

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState<string | null>(null);

  const factsMap = useMemo<FactRecord>(() => {
    const raw = (memoryFacts.data as any)?.facts;
    if (Array.isArray(raw)) {
      return raw.reduce((acc: FactRecord, entry: any) => {
        acc[String(entry.factKey || "")] = String(entry.factValue || "");
        return acc;
      }, {});
    }
    return raw && typeof raw === "object" ? raw as FactRecord : {};
  }, [memoryFacts.data]);

  const displayName = useMemo(() => {
    const authName = String(user?.name || "").trim();
    const memoryName = String(factsMap.user_name || factsMap.name || "").trim();
    return authName || memoryName || "User";
  }, [factsMap, user?.name]);

  const profileSubtitle = useMemo(() => {
    const village = String((user as any)?.village || factsMap.location_village || factsMap.village || "").trim();
    const district = String(user?.district || factsMap.location_district || factsMap.district || "").trim();
    const state = String(user?.state || factsMap.location_state || factsMap.state || "").trim();
    const parts = [village, district, state].filter(Boolean);
    return parts.length ? parts.join(", ") : "Voice-first rural assistant profile";
  }, [factsMap, user]);

  const currentLanguageCode = normalizeAppLanguage(user?.preferredLanguage || language);
  const currentLanguageLabel = useMemo(
    () => APP_LANGUAGES.find((entry) => entry.code === currentLanguageCode)?.description || "Hindi",
    [currentLanguageCode]
  );

  const avatarInitial = displayName.charAt(0).toUpperCase() || "U";

  const handleSelectLanguage = useCallback(async (nextLanguage: string) => {
    if (savingLanguage) return;
    setSavingLanguage(nextLanguage);

    const normalized = normalizeAppLanguage(nextLanguage);
    const nextUser = user
      ? { ...user, preferredLanguage: normalized }
      : null;

    try {
      setLanguage(normalized);
      if (nextUser) {
        updateUser(nextUser);
      }

      try {
        await authApi.updateProfile({ preferredLanguage: normalized });
      } catch (error: any) {
        logger.warn("ProfileScreen", "Profile language sync failed", { message: error?.message });
      }

      setLanguageModalVisible(false);
    } catch (error: any) {
      Alert.alert("Language update failed", error?.message ?? "Unable to change language right now.");
    } finally {
      setSavingLanguage(null);
    }
  }, [savingLanguage, setLanguage, updateUser, user]);

  const handleResetVoiceHistory = useCallback(() => {
    clearHistory();
    setSessionId(`voice-${Date.now()}`);
    setVoiceModalVisible(false);
    Alert.alert("Voice session reset", "Previous voice history has been cleared.");
  }, [clearHistory, setSessionId]);

  const handleLogout = useCallback(() => {
    Alert.alert("Log Out", "Do you want to log out from this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: () => {
          void logout();
        },
      },
    ]);
  }, [logout]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 132 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </View>
          </View>

          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtitle}>{profileSubtitle}</Text>

          <View style={styles.badgesRow}>
            <StatusPill
              icon="checkmark-circle"
              label={user?.isVerified ? "Verified" : "Profile"}
              backgroundColor={PALETTE.successBg}
              textColor={PALETTE.successInk}
            />
            <StatusPill
              icon="shield-checkmark-outline"
              label="Privacy"
              backgroundColor={PALETTE.privacyBg}
              textColor={PALETTE.privacyInk}
            />
          </View>
        </View>

        <SectionTitle title="Preferences" />
        <SettingsCard>
          <SettingsRow
            icon="language-outline"
            title="Language"
            subtitle={`${currentLanguageLabel} (Default)`}
            onPress={() => setLanguageModalVisible(true)}
          />
          <Divider />
          <SettingsRow
            icon="mic-outline"
            title="Voice Settings"
            subtitle={ttsEnabled ? "Hold to talk, spoken replies" : "Hold to talk, manual reading"}
            onPress={() => setVoiceModalVisible(true)}
          />
          <Divider />
          <ToggleRow
            icon="volume-high-outline"
            title="Voice responses (TTS)"
            subtitle="Read answers aloud"
            value={ttsEnabled}
            onChange={setTtsEnabled}
          />
        </SettingsCard>

        <SectionTitle title="Connectivity" />
        <SettingsCard>
          <ToggleRow
            icon="speedometer-outline"
            title="Low Data Mode"
            subtitle="Use less data on 2G/3G"
            value={lowDataMode}
            onChange={setLowDataMode}
          />
        </SettingsCard>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>

      <SheetModal
        visible={languageModalVisible}
        title="Choose Language"
        subtitle="This updates your voice and profile language."
        onClose={() => !savingLanguage && setLanguageModalVisible(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {APP_LANGUAGES.map((entry, index) => {
            const active = entry.code === currentLanguageCode;
            const loading = savingLanguage === entry.code;
            return (
              <React.Fragment key={entry.code}>
                <Pressable
                  style={[styles.sheetRow, active && styles.sheetRowActive]}
                  disabled={!!savingLanguage}
                  onPress={() => {
                    void handleSelectLanguage(entry.code);
                  }}
                >
                  <View style={styles.sheetRowCopy}>
                    <Text style={styles.sheetRowTitle}>{entry.description}</Text>
                    <Text style={styles.sheetRowSub}>{entry.label}</Text>
                  </View>
                  {loading ? (
                    <ActivityIndicator size="small" color={PALETTE.logoutInk} />
                  ) : active ? (
                    <Ionicons name="checkmark-circle" size={22} color={PALETTE.successInk} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={PALETTE.soft} />
                  )}
                </Pressable>
                {index < APP_LANGUAGES.length - 1 ? <Divider inset /> : null}
              </React.Fragment>
            );
          })}
        </ScrollView>
      </SheetModal>

      <SheetModal
        visible={voiceModalVisible}
        title="Voice Settings"
        subtitle="Control voice language and session reset."
        onClose={() => setVoiceModalVisible(false)}
      >
        <View style={styles.voiceSheetBlock}>
          <SettingsRow
            icon="language-outline"
            title="Voice language"
            subtitle={currentLanguageLabel}
            onPress={() => {
              setVoiceModalVisible(false);
              setLanguageModalVisible(true);
            }}
            embedded
          />
          <Divider inset />
          <SettingsRow
            icon="refresh-outline"
            title="Reset voice session"
            subtitle="Clear previous voice history and start fresh"
            onPress={handleResetVoiceHistory}
            embedded
          />
        </View>
      </SheetModal>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Divider({ inset = false }: { inset?: boolean }) {
  return <View style={[styles.divider, inset && styles.dividerInset]} />;
}

function StatusPill({
  icon,
  label,
  backgroundColor,
  textColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  backgroundColor: string;
  textColor: string;
}) {
  return (
    <View style={[styles.statusPill, { backgroundColor }]}>
      <Ionicons name={icon} size={14} color={textColor} />
      <Text style={[styles.statusPillText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  embedded = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  embedded?: boolean;
}) {
  return (
    <Pressable style={[styles.row, embedded && styles.rowEmbedded]} onPress={onPress}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          <Ionicons name={icon} size={24} color={PALETTE.ink} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={22} color="#D0C8A7" />
    </Pressable>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  embedded = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
  embedded?: boolean;
}) {
  return (
    <View style={[styles.row, embedded && styles.rowEmbedded]}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          <Ionicons name={icon} size={24} color={PALETTE.ink} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor="#FFFDF8"
        trackColor={{ false: PALETTE.toggleOff, true: PALETTE.toggleOn }}
        ios_backgroundColor={PALETTE.toggleOff}
      />
    </View>
  );
}

function SheetModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
            <Pressable style={styles.sheetClose} onPress={onClose}>
              <Ionicons name="close" size={20} color={PALETTE.ink} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.screen,
  },
  content: {
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: PALETTE.hero,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
    paddingTop: 18,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: PALETTE.heroShadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  avatarRing: {
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: PALETTE.avatarRing,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: PALETTE.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 46,
    fontWeight: "500",
    color: "#295924",
  },
  name: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  badgesRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "800",
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
    marginHorizontal: 24,
    fontSize: 22,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  card: {
    marginHorizontal: 24,
    backgroundColor: PALETTE.card,
    borderRadius: 28,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: PALETTE.line,
  },
  dividerInset: {
    marginLeft: 74,
  },
  row: {
    minHeight: 114,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  rowEmbedded: {
    minHeight: 92,
    paddingHorizontal: 0,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  rowIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PALETTE.iconBg,
    borderWidth: 1,
    borderColor: PALETTE.iconStroke,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  logoutButton: {
    marginTop: 160,
    marginHorizontal: 24,
    minHeight: 74,
    borderRadius: 28,
    backgroundColor: PALETTE.logoutBg,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    fontSize: 22,
    fontWeight: "900",
    color: PALETTE.logoutInk,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(21, 18, 15, 0.28)",
  },
  sheet: {
    backgroundColor: "#FBF8F2",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "72%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D7CEBD",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  sheetSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F2ECE0",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRow: {
    minHeight: 74,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sheetRowActive: {
    backgroundColor: "rgba(216, 233, 216, 0.35)",
  },
  sheetRowCopy: {
    flex: 1,
  },
  sheetRowTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  sheetRowSub: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  voiceSheetBlock: {
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
});

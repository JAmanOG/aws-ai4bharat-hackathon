import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSchemeDetail } from "../hooks/useData";
import { logger } from "../utils/logger";
import { ruralPalette as P } from "../theme/ruralPalette";

function getTypeAccent(type?: string) {
  switch ((type ?? "").toLowerCase()) {
    case "loan":
      return { bg: P.economics, ink: P.economicsIcon, icon: "cash-outline" as const };
    case "insurance":
      return { bg: P.health, ink: P.healthIcon, icon: "shield-checkmark-outline" as const };
    case "subsidy":
      return { bg: P.goldSoft, ink: P.goldDark, icon: "wallet-outline" as const };
    default:
      return { bg: P.surfaceSoft, ink: P.mutedDark, icon: "document-text-outline" as const };
  }
}

export default function SchemeDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const schemeId = (route?.params?.schemeId ?? "") as string;

  const { data: detail, loading, error, refresh } = useSchemeDetail(schemeId);
  const [saved, setSaved] = useState(false);
  const typeAccent = useMemo(() => getTypeAccent(detail?.type), [detail?.type]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => nav.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={28} color={P.ink} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>Scheme Detail</Text>
        <Pressable style={styles.saveButton} onPress={() => setSaved((value) => !value)}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={P.ink} />
          <Text style={styles.saveText}>{saved ? "Saved" : "Save"}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.stateWrap}>
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={P.goldDark} />
            <Text style={styles.stateTitle}>Loading scheme details</Text>
            <Text style={styles.stateText}>Pulling benefits, documents, and official contact information.</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={28} color={P.mutedDark} />
            <Text style={styles.stateTitle}>Could not load this scheme</Text>
            <Text style={styles.stateText}>{error.message}</Text>
            <Pressable style={styles.primaryButton} onPress={refresh}>
              <Text style={styles.primaryText}>Retry</Text>
              <Ionicons name="refresh" size={18} color={P.ink} />
            </Pressable>
          </View>
        </View>
      ) : !detail ? (
        <View style={styles.stateWrap}>
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={28} color={P.mutedDark} />
            <Text style={styles.stateTitle}>Scheme not found</Text>
            <Text style={styles.stateText}>This entry is no longer available in the current directory.</Text>
            <Pressable style={styles.primaryButton} onPress={() => nav.goBack()}>
              <Text style={styles.primaryText}>Go back</Text>
              <Ionicons name="arrow-back" size={18} color={P.ink} />
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={[styles.heroIcon, { backgroundColor: typeAccent.bg }]}>
                <Ionicons name={typeAccent.icon} size={22} color={typeAccent.ink} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>Verified scheme directory</Text>
                <Text style={styles.schemeTitle}>{detail.name}</Text>
                <Text style={styles.providerText}>{detail.provider || "Government support program"}</Text>
              </View>
            </View>

            <View style={styles.heroPillRow}>
              <View style={[styles.typePill, { backgroundColor: typeAccent.bg }]}>
                <Text style={[styles.typeText, { color: typeAccent.ink }]}>
                  {(detail.type || "scheme").toUpperCase()}
                </Text>
              </View>
              <View style={styles.verifiedPill}>
                <Ionicons name="checkmark-circle" size={14} color={P.healthIcon} />
                <Text style={styles.verifiedText}>
                  {detail.verified === false ? "Check latest notice" : "Official details"}
                </Text>
              </View>
            </View>

            {detail.benefit_summary ? (
              <Text style={styles.benefit}>{detail.benefit_summary}</Text>
            ) : null}
            {detail.summary ? (
              <Text style={styles.summary}>{detail.summary}</Text>
            ) : null}

            {saved ? (
              <View style={styles.savedPill}>
                <Ionicons name="cloud-done-outline" size={14} color={P.healthIcon} />
                <Text style={styles.savedText}>Saved for offline review</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.factsRow}>
            <View style={styles.factCard}>
              <Text style={styles.factLabel}>Documents</Text>
              <Text style={styles.factValue}>{detail.documents_required?.length ?? 0}</Text>
              <Text style={styles.factMeta}>items to prepare</Text>
            </View>
            <View style={styles.factCard}>
              <Text style={styles.factLabel}>Best fit</Text>
              <Text style={styles.factValue}>{detail.recommended_for?.length ?? 0}</Text>
              <Text style={styles.factMeta}>profiles noted</Text>
            </View>
          </View>

          <View style={styles.factsRow}>
            <View style={styles.factCard}>
              <Text style={styles.factLabel}>Bank account</Text>
              <Text style={styles.factValueSmall}>{detail.requires_bank_account ? "Required" : "Optional"}</Text>
              <Text style={styles.factMeta}>application readiness</Text>
            </View>
            <View style={styles.factCard}>
              <Text style={styles.factLabel}>Land rule</Text>
              <Text style={styles.factValueSmall}>
                {detail.min_land_acres > 0 ? `${detail.min_land_acres} acre min` : "No minimum"}
              </Text>
              <Text style={styles.factMeta}>based on scheme data</Text>
            </View>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Documents you need</Text>
            {(detail.documents_required ?? []).length > 0 ? (
              detail.documents_required.map((document: string, index: number) => (
                <View key={`${document}-${index}`} style={styles.rowItem}>
                  <Ionicons name="checkmark-circle" size={18} color={P.healthIcon} />
                  <Text style={styles.rowText}>{document}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.sectionHint}>Open the official portal for the latest required document list.</Text>
            )}
          </View>

          {detail.recommended_for?.length > 0 ? (
            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Recommended for</Text>
              {detail.recommended_for.map((item: string, index: number) => (
                <View key={`${item}-${index}`} style={styles.rowItem}>
                  <Ionicons name="sparkles-outline" size={18} color={P.goldDark} />
                  <Text style={styles.rowText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {detail.states?.length > 0 ? (
            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Available in</Text>
              <View style={styles.stateChips}>
                {detail.states.map((state) => (
                  <View key={state} style={styles.stateChip}>
                    <Text style={styles.stateChipText}>{state}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              logger.info("SchemeDetail", "Open Apply Portal", { schemeId });
              const url = detail.apply_url || "https://services.india.gov.in";
              Linking.openURL(url).catch(() => {
                Alert.alert("Cannot Open", "Could not open the portal. Try again later.");
              });
            }}
          >
            <Text style={styles.primaryText}>Open apply portal</Text>
            <Ionicons name="open-outline" size={18} color={P.ink} />
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              logger.info("SchemeDetail", "Call Helpline");
              const phone = detail.helpline || "14444";
              Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("Call", `Helpline: ${phone}`));
            }}
          >
            <Text style={styles.secondaryText}>Call helpline</Text>
            <Ionicons name="call-outline" size={18} color={P.ink} />
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: P.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: P.bgWarm,
    borderBottomWidth: 1,
    borderBottomColor: P.lineSoft,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
    color: P.ink,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#FFF1C9",
    borderWidth: 1,
    borderColor: "#E8D59F",
  },
  saveText: {
    fontSize: 12,
    fontWeight: "900",
    color: P.ink,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 160,
    gap: 16,
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  stateCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    alignItems: "center",
    gap: 8,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  stateText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: P.mutedDark,
    textAlign: "center",
  },
  heroCard: {
    borderRadius: 30,
    padding: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: "#E2D0A4",
    shadowColor: P.goldShadow,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: P.goldDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  schemeTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "900",
    color: P.ink,
  },
  providerText: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: "700",
    color: P.mutedDark,
  },
  heroPillRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#D7E7CA",
    borderRadius: 18,
    backgroundColor: "#EDF5E4",
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "900",
    color: P.ink,
  },
  benefit: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: P.goldDark,
  },
  summary: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: P.mutedDark,
  },
  savedPill: {
    marginTop: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#D7E7CA",
    borderRadius: 18,
    backgroundColor: "#EDF5E4",
  },
  savedText: {
    fontSize: 11,
    fontWeight: "900",
    color: P.ink,
  },
  factsRow: {
    flexDirection: "row",
    gap: 12,
  },
  factCard: {
    flex: 1,
    borderRadius: 26,
    padding: 16,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
  },
  factLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: P.mutedDark,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  factValue: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: "900",
    color: P.ink,
  },
  factValueSmall: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "900",
    color: P.ink,
  },
  factMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: P.mutedDark,
  },
  detailCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#F9F4E8",
    borderWidth: 1,
    borderColor: P.lineSoft,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: P.ink,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: P.mutedDark,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: P.ink,
  },
  stateChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: P.mutedDark,
  },
  primaryButton: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: "#EFD27A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "900",
    color: P.ink,
    textTransform: "capitalize",
  },
  secondaryButton: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "900",
    color: P.ink,
    textTransform: "capitalize",
  },
});

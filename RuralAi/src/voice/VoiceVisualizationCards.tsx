/**
 * VoiceVisualizationCards — Dynamic visual cards rendered in response to voice commands.
 *
 * Each card type corresponds to a VisualizationCard.kind from VoiceCommandEngine.
 * The screen acts as a real-time visual representation of the user's spoken requests.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import type { VisualizationCard } from "./VoiceCommandEngine";
import {
  FinancialOverviewView,
  InsuranceClaimsView,
  LoanEligibilityView,
  useFinancialOverviewModel,
  useInsuranceModel,
  useLoanEligibilityModel,
} from "../components/EconomicsResponses";
import {
  MarketListingsView,
  coerceMarketDashboardModel,
} from "../components/MarketListingsResponse";

/* ─── Master card renderer ─── */

export function VisualizationCardRenderer({
  card,
}: {
  card: VisualizationCard;
}) {
  switch (card.kind) {
    case "price_chart":
      return <PriceChartCard card={card} />;
    case "scheme_list":
      return <SchemeListCard card={card} />;
    case "weather_info":
      return <WeatherCard card={card} />;
    case "crop_advisory":
      return <CropAdvisoryCard card={card} />;
    case "savings_plan":
      return <SavingsPlanCard card={card} />;
    case "course_list":
      return <CourseListCard card={card} />;
    case "insurance_status":
      return <InsuranceCard card={card} />;
    case "transport_options":
      return <TransportCard card={card} />;
    case "peer_groups":
      return <PeerGroupCard card={card} />;
    case "practice_log":
      return <PracticeCard card={card} />;
    case "eligibility_score":
      return <EligibilityCard card={card} />;
    case "order_list":
      return <OrderCard card={card} />;
    case "error":
      return <ErrorCard card={card} />;
    default:
      return <GenericInfoCard card={card} />;
  }
}

/* ─── Price Chart Card ─── */

function PriceChartCard({ card }: { card: VisualizationCard }) {
  const location = card.entities?.location ?? "";
  return (
    <View style={[styles.card, { borderLeftColor: "#1565C0", borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(21,101,192,0.12)" }]}>
          <Ionicons name="trending-up" size={20} color="#1565C0" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{card.title}</Text>
          {location ? <Text style={styles.cardSub}>{location}</Text> : null}
        </View>
        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Scheme List Card ─── */

function SchemeListCard({ card }: { card: VisualizationCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: "#6A1B9A", borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(106,27,154,0.12)" }]}>
          <Ionicons name="document-text" size={20} color="#6A1B9A" />
        </View>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{card.title}</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Weather Card ─── */

function WeatherCard({ card }: { card: VisualizationCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: "#00838F", borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(0,131,143,0.12)" }]}>
          <Ionicons name="cloud" size={20} color="#00838F" />
        </View>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{card.title}</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Crop Advisory Card ─── */

function CropAdvisoryCard({ card }: { card: VisualizationCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: "#2E7D32", borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(46,125,50,0.12)" }]}>
          <Ionicons name="leaf" size={20} color="#2E7D32" />
        </View>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{card.title}</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Savings Card ─── */

function SavingsPlanCard({ card }: { card: VisualizationCard }) {
  const model = useFinancialOverviewModel();
  return <FinancialOverviewView model={model} compact />;
}

/* ─── Course List Card ─── */

function CourseListCard({ card }: { card: VisualizationCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: colors.primary, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryTint }]}>
          <Ionicons name="school" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{card.title}</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Insurance Card ─── */

function InsuranceCard({ card }: { card: VisualizationCard }) {
  const model = useInsuranceModel();
  return <InsuranceClaimsView model={model} compact />;
}

/* ─── Transport Card ─── */

function TransportCard({ card }: { card: VisualizationCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: "#5D4037", borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(93,64,55,0.12)" }]}>
          <Ionicons name="car" size={20} color="#5D4037" />
        </View>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{card.title}</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Peer Group Card ─── */

function PeerGroupCard({ card }: { card: VisualizationCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: colors.primary, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryTint }]}>
          <Ionicons name="people" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{card.title}</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Practice Card ─── */

function PracticeCard({ card }: { card: VisualizationCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: "#2E7D32", borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(46,125,50,0.12)" }]}>
          <Ionicons name="leaf" size={20} color="#2E7D32" />
        </View>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{card.title}</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Eligibility Card ─── */

function EligibilityCard({ card }: { card: VisualizationCard }) {
  const model = useLoanEligibilityModel();
  return <LoanEligibilityView model={model} compact />;
}

/* ─── Order Card ─── */

function OrderCard({ card }: { card: VisualizationCard }) {
  const model = coerceMarketDashboardModel(card.data?.metadata?.market);
  if (model) {
    return <MarketListingsView model={model} compact />;
  }

  return (
    <View style={[styles.card, { borderLeftColor: "#1565C0", borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(21,101,192,0.12)" }]}>
          <Ionicons name="receipt" size={20} color="#1565C0" />
        </View>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{card.title}</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Error Card ─── */

function ErrorCard({ card }: { card: VisualizationCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: colors.danger, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <Ionicons name="warning" size={20} color={colors.danger} />
        <Text style={[styles.cardTitle, { flex: 1, color: colors.danger }]}>Error</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText ?? "Something went wrong"}</Text>
    </View>
  );
}

/* ─── Generic Card ─── */

function GenericInfoCard({ card }: { card: VisualizationCard }) {
  return (
    <View style={[styles.card, { borderLeftColor: colors.primary, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryTint }]}>
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{card.title}</Text>
      </View>
      <Text style={styles.responseText}>{card.data?.responseText}</Text>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.ink,
  },
  cardSub: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 1,
  },
  responseText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 20,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.successTint,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.success,
    letterSpacing: 0.5,
  },
});

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const P = {
  screen: "#F8F1E4",
  card: "#FFF9EE",
  cardSoft: "#F9E8CF",
  line: "#EACF9F",
  lineSoft: "#EFE4CC",
  ink: "#2B1B10",
  muted: "#7D6754",
  gold: "#EAC768",
  goldDark: "#A87518",
  goldSoft: "#F6E39E",
  success: "#7F6A1E",
  successSoft: "#F6E8B8",
  warm: "#EAA15A",
  warmSoft: "#F7D7AF",
};

export interface MarketBuyerCard {
  id: string;
  kind?: "order" | "buyer";
  title: string;
  subtitle?: string;
  demandKg?: number;
  offerPricePerKg?: number;
  offerPricePerQuintal?: number;
  trustScore?: number;
  verified?: boolean;
  locationLabel?: string;
  interestLabel?: string;
  contactPhone?: string;
  contactEmail?: string;
  status?: string;
  notes?: string;
}

export interface MarketNearbyListingCard {
  id: string;
  cropType: string;
  quantityKg?: number;
  pricePerKg?: number;
  pricePerQuintal?: number;
  locationLabel?: string;
  qualityGrade?: string;
}

export interface MarketActiveListing {
  id: string;
  cropType: string;
  title: string;
  quantityKg?: number;
  pricePerKg?: number;
  pricePerQuintal?: number;
  qualityGrade?: string;
  visibilityLabel?: string;
  locationState?: string;
  locationDistrict?: string;
  status?: string;
  description?: string;
}

export interface MarketContactProfile {
  name?: string;
  phone?: string;
  state?: string;
  district?: string;
  pincode?: string;
  village?: string;
  missingFields?: string[];
  readinessLabel?: string;
}

export interface MarketDashboardModel {
  prompt: string;
  examples: string[];
  summary?: string;
  focusCrop?: string;
  focusState?: string;
  focusDistrict?: string;
  activeListing: MarketActiveListing | null;
  buyerRequests: MarketBuyerCard[];
  buyerSectionTitle?: string;
  nearbyListings: MarketNearbyListingCard[];
  contactProfile: MarketContactProfile;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function formatKg(value?: number): string {
  const amount = toNumber(value);
  if (!amount) return "";
  return `${Math.round(amount)} kg`;
}

function formatPerQuintal(pricePerQuintal?: number, pricePerKg?: number): string {
  const qtl = toNumber(pricePerQuintal) || (toNumber(pricePerKg) ? Math.round(toNumber(pricePerKg) * 100) : 0);
  if (!qtl) return "";
  return `Rs ${qtl}/quintal`;
}

function formatLocation(...parts: Array<string | undefined>): string {
  return parts.map((part) => toStringValue(part).trim()).filter(Boolean).join(", ");
}

function capitalizeWords(value?: string): string {
  return toStringValue(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function coerceMarketDashboardModel(raw: any): MarketDashboardModel | null {
  if (!raw || typeof raw !== "object") return null;

  const activeListingRaw = raw.activeListing && typeof raw.activeListing === "object" ? raw.activeListing : null;
  const contactProfileRaw = raw.contactProfile && typeof raw.contactProfile === "object" ? raw.contactProfile : {};
  const buyerRequestsRaw = Array.isArray(raw.buyerRequests) ? raw.buyerRequests : [];
  const nearbyListingsRaw = Array.isArray(raw.nearbyListings) ? raw.nearbyListings : [];

  return {
    prompt: toStringValue(raw.prompt) || "Tap and hold the mic.",
    examples: Array.isArray(raw.examples) ? raw.examples.map((item: unknown) => toStringValue(item)).filter(Boolean) : [],
    summary: toStringValue(raw.summary),
    focusCrop: toStringValue(raw.focusCrop),
    focusState: toStringValue(raw.focusState),
    focusDistrict: toStringValue(raw.focusDistrict),
    activeListing: activeListingRaw
      ? {
          id: toStringValue(activeListingRaw.id),
          cropType: toStringValue(activeListingRaw.cropType),
          title: toStringValue(activeListingRaw.title),
          quantityKg: toNumber(activeListingRaw.quantityKg),
          pricePerKg: toNumber(activeListingRaw.pricePerKg),
          pricePerQuintal: toNumber(activeListingRaw.pricePerQuintal),
          qualityGrade: toStringValue(activeListingRaw.qualityGrade),
          visibilityLabel: toStringValue(activeListingRaw.visibilityLabel),
          locationState: toStringValue(activeListingRaw.locationState),
          locationDistrict: toStringValue(activeListingRaw.locationDistrict),
          status: toStringValue(activeListingRaw.status),
          description: toStringValue(activeListingRaw.description),
        }
      : null,
    buyerRequests: buyerRequestsRaw.map((item: any) => ({
      id: toStringValue(item?.id),
      kind: item?.kind === "buyer" ? "buyer" : "order",
      title: toStringValue(item?.title),
      subtitle: toStringValue(item?.subtitle),
      demandKg: toNumber(item?.demandKg),
      offerPricePerKg: toNumber(item?.offerPricePerKg),
      offerPricePerQuintal: toNumber(item?.offerPricePerQuintal),
      trustScore: toNumber(item?.trustScore),
      verified: !!item?.verified,
      locationLabel: toStringValue(item?.locationLabel),
      interestLabel: toStringValue(item?.interestLabel),
      contactPhone: toStringValue(item?.contactPhone),
      contactEmail: toStringValue(item?.contactEmail),
      status: toStringValue(item?.status),
      notes: toStringValue(item?.notes),
    })),
    buyerSectionTitle: toStringValue(raw.buyerSectionTitle) || "Verified Buyers Nearby",
    nearbyListings: nearbyListingsRaw.map((item: any) => ({
      id: toStringValue(item?.id),
      cropType: toStringValue(item?.cropType),
      quantityKg: toNumber(item?.quantityKg),
      pricePerKg: toNumber(item?.pricePerKg),
      pricePerQuintal: toNumber(item?.pricePerQuintal),
      locationLabel: toStringValue(item?.locationLabel),
      qualityGrade: toStringValue(item?.qualityGrade),
    })),
    contactProfile: {
      name: toStringValue(contactProfileRaw.name),
      phone: toStringValue(contactProfileRaw.phone),
      state: toStringValue(contactProfileRaw.state),
      district: toStringValue(contactProfileRaw.district),
      pincode: toStringValue(contactProfileRaw.pincode),
      village: toStringValue(contactProfileRaw.village),
      missingFields: Array.isArray(contactProfileRaw.missingFields)
        ? contactProfileRaw.missingFields.map((field: unknown) => toStringValue(field)).filter(Boolean)
        : [],
      readinessLabel: toStringValue(contactProfileRaw.readinessLabel),
    },
  };
}

export function MarketListingsView({
  model,
  compact = false,
  onBuyerPress,
  onListingAction,
  onRefreshPress,
}: {
  model: MarketDashboardModel;
  compact?: boolean;
  onBuyerPress?: (buyer: MarketBuyerCard) => void;
  onListingAction?: (listing: MarketActiveListing, status: "sold" | "cancelled") => void;
  onRefreshPress?: () => void;
}) {
  const buyerCards = compact ? model.buyerRequests.slice(0, 2) : model.buyerRequests;
  const nearbyCards = compact ? model.nearbyListings.slice(0, 3) : model.nearbyListings;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <View style={[styles.micOrb, compact && styles.micOrbCompact]}>
          <Ionicons name="mic" size={compact ? 24 : 34} color={P.goldDark} />
        </View>
        <Text style={[styles.prompt, compact && styles.promptCompact]}>{model.prompt}</Text>
        {model.examples.length > 0 ? (
          <Text style={[styles.examples, compact && styles.examplesCompact]}>
            E.g., "{model.examples[0]}"{model.examples[1] ? ` or "${model.examples[1]}"` : ""}
          </Text>
        ) : null}
      </View>

      {model.summary ? (
        <View style={styles.summaryCard}>
          <Ionicons name="information-circle" size={18} color={P.goldDark} />
          <Text style={styles.summaryText}>{model.summary}</Text>
          {onRefreshPress ? (
            <Pressable style={styles.refreshChip} onPress={onRefreshPress}>
              <Ionicons name="refresh" size={14} color={P.goldDark} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>My Active Sell Listing</Text>
        {model.activeListing ? (
          <>
            <Text style={styles.primaryTitle}>{model.activeListing.title}</Text>
            <Text style={styles.primaryMeta}>
              Asking Price: {formatPerQuintal(model.activeListing.pricePerQuintal, model.activeListing.pricePerKg)}
            </Text>
            <View style={styles.listingMetaRow}>
              <View style={styles.statusPill}>
                <Ionicons name="checkmark-circle" size={14} color={P.success} />
                <Text style={styles.statusText}>{model.activeListing.visibilityLabel || "Visible to buyers"}</Text>
              </View>
              {model.activeListing.qualityGrade ? (
                <Text style={styles.miniText}>{capitalizeWords(model.activeListing.qualityGrade)}</Text>
              ) : null}
            </View>
            {onListingAction ? (
              <View style={styles.actionRow}>
                <Pressable style={styles.secondaryAction} onPress={() => onListingAction(model.activeListing!, "sold")}>
                  <Text style={styles.secondaryActionText}>Mark sold</Text>
                </Pressable>
                <Pressable style={styles.secondaryAction} onPress={() => onListingAction(model.activeListing!, "cancelled")}>
                  <Text style={styles.secondaryActionText}>Remove</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.primaryTitle}>No active listing yet</Text>
            <Text style={styles.primaryMeta}>
              Use voice to say, "I want to sell 1000kg of wheat at 24 rupees per kg."
            </Text>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>{model.buyerSectionTitle || "Verified Buyers Nearby"}</Text>
      {buyerCards.length > 0 ? buyerCards.map((buyer) => {
        const canContact = !!(buyer.contactPhone || buyer.contactEmail);
        return (
          <View key={buyer.id} style={styles.buyerCard}>
            <View style={styles.buyerCopy}>
              <Text style={styles.buyerTitle}>{buyer.title}</Text>
              {buyer.demandKg ? (
                <Text style={styles.buyerMeta}>Demand: {formatKg(buyer.demandKg)}</Text>
              ) : buyer.interestLabel ? (
                <Text style={styles.buyerMeta}>{buyer.interestLabel}</Text>
              ) : null}
              {buyer.offerPricePerQuintal ? (
                <Text style={styles.buyerPrice}>Offer: {formatPerQuintal(buyer.offerPricePerQuintal, buyer.offerPricePerKg)}</Text>
              ) : buyer.trustScore ? (
                <Text style={styles.buyerPrice}>Trust score: {Math.round(buyer.trustScore)}/100</Text>
              ) : null}
              {buyer.locationLabel ? <Text style={styles.auxText}>{buyer.locationLabel}</Text> : null}
            </View>
            {canContact && onBuyerPress ? (
              <Pressable style={styles.contactBtn} onPress={() => onBuyerPress(buyer)}>
                <Text style={styles.contactText}>Contact buyer</Text>
              </Pressable>
            ) : (
              <View style={styles.verifiedPill}>
                <Ionicons name="shield-checkmark" size={14} color={P.goldDark} />
                <Text style={styles.verifiedText}>{buyer.verified ? "Verified" : "Listed"}</Text>
              </View>
            )}
          </View>
        );
      }) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No buyer matches yet. Try another crop or refresh this market view.</Text>
        </View>
      )}

      {nearbyCards.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Nearby Seller Listings</Text>
          <View style={styles.grid}>
            {nearbyCards.map((listing) => (
              <View key={listing.id} style={styles.sellerCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{capitalizeWords(listing.cropType).charAt(0) || "F"}</Text>
                </View>
                <Text style={styles.sellerTitle}>{capitalizeWords(listing.cropType)}</Text>
                {listing.quantityKg ? <Text style={styles.sellerMeta}>{formatKg(listing.quantityKg)}</Text> : null}
                {listing.pricePerQuintal ? <Text style={styles.sellerPrice}>{formatPerQuintal(listing.pricePerQuintal, listing.pricePerKg)}</Text> : null}
                {listing.locationLabel ? <Text style={styles.auxText}>{listing.locationLabel}</Text> : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Ionicons name="person-circle" size={22} color={P.goldDark} />
          <Text style={styles.profileTitle}>Saved seller profile</Text>
        </View>
        <Text style={styles.profileBody}>{model.contactProfile.readinessLabel || "Profile details will be reused for voice listings."}</Text>
        <Text style={styles.profileBodySecondary}>
          {[model.contactProfile.name, model.contactProfile.phone, formatLocation(model.contactProfile.village, model.contactProfile.district, model.contactProfile.state)].filter(Boolean).join("  •  ")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  wrapCompact: {
    gap: 10,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  heroCompact: {
    paddingTop: 2,
  },
  micOrb: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.goldSoft,
    borderWidth: 1.5,
    borderColor: P.line,
    shadowColor: P.goldDark,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  micOrbCompact: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  prompt: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  promptCompact: {
    fontSize: 15,
  },
  examples: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: P.ink,
  },
  examplesCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 20,
    backgroundColor: P.cardSoft,
    borderWidth: 1,
    borderColor: P.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: P.ink,
  },
  refreshChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.goldSoft,
  },
  sectionCard: {
    borderRadius: 24,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.lineSoft,
    padding: 18,
    shadowColor: P.goldDark,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionEyebrow: {
    fontSize: 13,
    fontWeight: "900",
    color: P.ink,
  },
  primaryTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "900",
    color: P.ink,
  },
  primaryMeta: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: P.ink,
  },
  listingMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: P.successSoft,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    color: P.success,
  },
  miniText: {
    fontSize: 12,
    fontWeight: "700",
    color: P.muted,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  secondaryAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.line,
    backgroundColor: P.cardSoft,
    paddingVertical: 11,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: P.ink,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: P.ink,
    marginTop: 4,
  },
  buyerCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    borderRadius: 22,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.lineSoft,
    padding: 16,
  },
  buyerCopy: {
    flex: 1,
    gap: 3,
  },
  buyerTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: P.ink,
  },
  buyerMeta: {
    fontSize: 13,
    fontWeight: "700",
    color: P.ink,
  },
  buyerPrice: {
    fontSize: 14,
    fontWeight: "900",
    color: P.ink,
  },
  auxText: {
    fontSize: 11,
    color: P.muted,
    fontWeight: "700",
  },
  contactBtn: {
    minWidth: 118,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: P.goldSoft,
    borderWidth: 1,
    borderColor: P.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contactText: {
    fontSize: 12,
    fontWeight: "900",
    color: P.goldDark,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: P.warmSoft,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "800",
    color: P.goldDark,
  },
  emptyCard: {
    borderRadius: 18,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.lineSoft,
    padding: 16,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: P.muted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sellerCard: {
    width: "47%",
    minWidth: 132,
    borderRadius: 22,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.lineSoft,
    padding: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.warmSoft,
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "900",
    color: P.goldDark,
  },
  sellerTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: P.ink,
  },
  sellerMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: P.ink,
  },
  sellerPrice: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "900",
    color: P.ink,
  },
  profileCard: {
    borderRadius: 20,
    backgroundColor: P.cardSoft,
    borderWidth: 1,
    borderColor: P.line,
    padding: 16,
    gap: 6,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: P.ink,
  },
  profileBody: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: P.ink,
  },
  profileBodySecondary: {
    fontSize: 11,
    lineHeight: 17,
    color: P.muted,
    fontWeight: "700",
  },
});

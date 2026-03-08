import React, { useCallback, useEffect, useMemo } from "react";
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
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { HomeStackParamList } from "../navigation/HomeStack";
import {
  MarketListingsView,
  coerceMarketDashboardModel,
  type MarketActiveListing,
  type MarketBuyerCard,
  type MarketDashboardModel,
} from "../components/MarketListingsResponse";
import {
  useBuyers,
  useMarketListingsSearch,
  useMyListings,
  useUnifiedProfile,
} from "../hooks/useData";
import { supplyChainApi } from "../services/api";
import { useScreenContext } from "../context/ScreenContext";
import { useVoice } from "../voice/VoiceContext";

const S = {
  bg: "#F7F0E3",
  headerInk: "#2B1B10",
  headerMuted: "#876B48",
  headerCard: "#F5E7C8",
  line: "#E8D6B2",
};

type OrdersRoute = RouteProp<HomeStackParamList, "Orders">;

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

function capitalizeWords(value?: string): string {
  return toStringValue(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function firstCropValue(value: unknown): string {
  if (Array.isArray(value)) return toStringValue(value[0]);
  return toStringValue(value);
}

function normalizeListing(raw: any): MarketActiveListing | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: toStringValue(raw.id ?? raw.listing_id),
    cropType: toStringValue(raw.crop_type),
    title: `${capitalizeWords(raw.crop_type)} - ${Math.round(toNumber(raw.quantity_kg))}kg`,
    quantityKg: toNumber(raw.quantity_kg),
    pricePerKg: toNumber(raw.price_per_kg),
    pricePerQuintal: toNumber(raw.price_per_kg) ? Math.round(toNumber(raw.price_per_kg) * 100) : 0,
    qualityGrade: toStringValue(raw.quality_grade),
    visibilityLabel: toStringValue(raw.status).toLowerCase() === "active" ? "Visible to buyers" : capitalizeWords(raw.status),
    locationState: toStringValue(raw.location_state),
    locationDistrict: toStringValue(raw.location_district),
    status: toStringValue(raw.status || "active"),
    description: toStringValue(raw.description),
  };
}

function normalizeBuyer(raw: any, cropHint: string): MarketBuyerCard {
  return {
    id: toStringValue(raw?.id),
    kind: "buyer",
    title: toStringValue(raw?.business_name || "Verified buyer"),
    subtitle: capitalizeWords(raw?.business_type || "buyer"),
    demandKg: 0,
    offerPricePerKg: 0,
    offerPricePerQuintal: 0,
    trustScore: toNumber(raw?.trust_score),
    verified: !!raw?.is_verified,
    locationLabel: [toStringValue(raw?.location_district), toStringValue(raw?.location_state)].filter(Boolean).join(", "),
    interestLabel: cropHint ? `Interested in ${capitalizeWords(cropHint)}` : "Interested buyer nearby",
    contactPhone: toStringValue(raw?.contact_phone),
    contactEmail: toStringValue(raw?.contact_email),
  };
}

function normalizeNearby(raw: any) {
  return {
    id: toStringValue(raw?.id),
    cropType: toStringValue(raw?.crop_type),
    quantityKg: toNumber(raw?.quantity_kg),
    pricePerKg: toNumber(raw?.price_per_kg),
    pricePerQuintal: toNumber(raw?.price_per_kg) ? Math.round(toNumber(raw?.price_per_kg) * 100) : 0,
    locationLabel: [toStringValue(raw?.location_district), toStringValue(raw?.location_state)].filter(Boolean).join(", "),
    qualityGrade: toStringValue(raw?.quality_grade),
  };
}

function buildLiveModel({
  routeCrop,
  routeLocation,
  voiceModel,
  profile,
  listings,
  buyers,
  nearby,
}: {
  routeCrop: string;
  routeLocation: string;
  voiceModel: MarketDashboardModel | null;
  profile: any;
  listings: any[];
  buyers: any[];
  nearby: any[];
}): MarketDashboardModel {
  const activeListings = listings.filter((listing) => toStringValue(listing.status).toLowerCase() === "active");
  const pickedListing = activeListings.find((listing) => {
    if (!routeCrop) return false;
    return toStringValue(listing.crop_type).toLowerCase() === routeCrop.toLowerCase();
  }) ?? activeListings[0] ?? null;

  const activeListing = normalizeListing(pickedListing) ?? voiceModel?.activeListing ?? null;
  const focusCrop = routeCrop || activeListing?.cropType || voiceModel?.focusCrop || firstCropValue(profile?.crops) || "";
  const focusState = routeLocation || activeListing?.locationState || voiceModel?.focusState || toStringValue(profile?.state) || "";
  const focusDistrict = activeListing?.locationDistrict || voiceModel?.focusDistrict || toStringValue(profile?.district) || "";

  const buyerRequests = buyers.length > 0
    ? buyers.map((buyer) => normalizeBuyer(buyer, focusCrop)).filter((buyer) => buyer.id)
    : (voiceModel?.buyerRequests ?? []);

  const nearbyListings = nearby.length > 0
    ? nearby
        .filter((listing) => toStringValue(listing.farmer_id) !== toStringValue(profile?.userId))
        .map(normalizeNearby)
        .filter((listing) => listing.id && listing.id !== activeListing?.id)
    : (voiceModel?.nearbyListings ?? []);

  const missingFields = [
    !toStringValue(profile?.name) ? "name" : "",
    !toStringValue(profile?.phone) ? "phone" : "",
    !toStringValue(profile?.state) ? "state" : "",
    !toStringValue(profile?.district) ? "district" : "",
    !toStringValue(profile?.pincode) ? "pincode" : "",
  ].filter(Boolean);

  const summary = voiceModel?.summary
    || [
      activeListing ? `Active listing: ${capitalizeWords(activeListing.cropType)}` : "No active listing yet",
      buyerRequests.length ? `${buyerRequests.length} buyer matches ready` : "No buyer matches yet",
      nearbyListings.length ? `${nearbyListings.length} nearby seller listings visible` : "",
      missingFields.length ? `Profile missing ${missingFields.join(", ")}` : "",
    ].filter(Boolean).join(". ");

  return {
    prompt: voiceModel?.prompt || "Tap and hold the mic.",
    examples: voiceModel?.examples?.length
      ? voiceModel.examples
      : [
          "I want to sell 1000kg of wheat",
          "Are there buyers nearby?",
        ],
    summary,
    focusCrop,
    focusState,
    focusDistrict,
    activeListing,
    buyerRequests,
    buyerSectionTitle: voiceModel?.buyerSectionTitle || "Verified Buyers Nearby",
    nearbyListings,
    contactProfile: {
      name: toStringValue(profile?.name),
      phone: toStringValue(profile?.phone),
      state: toStringValue(profile?.state),
      district: toStringValue(profile?.district),
      pincode: toStringValue(profile?.pincode),
      village: toStringValue(profile?.village),
      missingFields,
      readinessLabel: missingFields.length === 0 ? "Saved seller profile ready" : `Missing ${missingFields.join(", ")}`,
    },
  };
}

export default function OrdersScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<OrdersRoute>();
  const { currentVisualization } = useVoice();
  const screenContext = useScreenContext();

  const voiceModel = useMemo(
    () => coerceMarketDashboardModel(currentVisualization?.data?.metadata?.market),
    [currentVisualization],
  );

  const routeCrop = toStringValue(route.params?.crop);
  const routeLocation = toStringValue(route.params?.location);

  const profile = useUnifiedProfile();
  const listings = useMyListings();

  const profileData = ((profile.data as any)?.profile ?? {}) as any;
  const listingsData = (((listings.data as any)?.listings ?? []) as any[]);

  const fallbackCrop = routeCrop
    || voiceModel?.focusCrop
    || toStringValue(listingsData.find((item) => toStringValue(item.status).toLowerCase() === "active")?.crop_type)
    || firstCropValue(profileData?.crops);
  const fallbackState = routeLocation || voiceModel?.focusState || toStringValue(profileData?.state);

  const buyers = useBuyers({
    ...(fallbackCrop ? { crop_type: fallbackCrop } : {}),
    ...(fallbackState ? { state: fallbackState } : {}),
    verified: true,
    limit: 4,
  });

  const nearbyListings = useMarketListingsSearch({
    ...(fallbackCrop ? { crop_type: fallbackCrop } : {}),
    ...(fallbackState ? { state: fallbackState } : {}),
    limit: 6,
  });

  const buyerData = (((buyers.data as any)?.buyers ?? []) as any[]);
  const nearbyData = (((nearbyListings.data as any)?.listings ?? []) as any[]);

  const model = useMemo(
    () => buildLiveModel({
      routeCrop,
      routeLocation,
      voiceModel,
      profile: profileData,
      listings: listingsData,
      buyers: buyerData,
      nearby: nearbyData,
    }),
    [buyerData, listingsData, nearbyData, profileData, routeCrop, routeLocation, voiceModel],
  );

  useFocusEffect(
    useCallback(() => {
      profile.refresh();
      listings.refresh();
      buyers.refresh();
      nearbyListings.refresh();
    }, [buyers, listings, nearbyListings, profile]),
  );

  useEffect(() => {
    screenContext.set({
      screen: "Orders",
      crop: model.focusCrop || undefined,
      location: model.focusState || undefined,
      meta: {
        availableActions: "create listing, contact buyer, mark sold, remove listing, refresh market",
        activeListingCrop: model.activeListing?.cropType || "none",
        buyerMatchCount: String(model.buyerRequests.length),
      },
    });
  }, [model.activeListing?.cropType, model.buyerRequests.length, model.focusCrop, model.focusState, screenContext]);

  const handleRefresh = useCallback(() => {
    profile.refresh();
    listings.refresh();
    buyers.refresh();
    nearbyListings.refresh();
  }, [buyers, listings, nearbyListings, profile]);

  const handleListingAction = useCallback(async (listing: MarketActiveListing, status: "sold" | "cancelled") => {
    try {
      await supplyChainApi.updateListingStatus(listing.id, status);
      Alert.alert("Updated", status === "sold" ? "Listing marked as sold." : "Listing removed from buyers.");
      handleRefresh();
    } catch (error: any) {
      Alert.alert("Update failed", error?.message ?? "Could not update the listing right now.");
    }
  }, [handleRefresh]);

  const handleBuyerPress = useCallback(async (buyer: MarketBuyerCard) => {
    const actions = [];
    if (buyer.contactPhone) {
      actions.push({
        text: "Call",
        onPress: () => {
          void Linking.openURL(`tel:${buyer.contactPhone}`);
        },
      });
    }
    if (buyer.contactEmail) {
      actions.push({
        text: "Email",
        onPress: () => {
          void Linking.openURL(`mailto:${buyer.contactEmail}`);
        },
      });
    }
    actions.push({ text: "Close", style: "cancel" as const });

    Alert.alert(
      buyer.title,
      [buyer.contactPhone, buyer.contactEmail, buyer.locationLabel].filter(Boolean).join("\n"),
      actions,
    );
  }, []);

  const isInitialLoading = profile.loading || listings.loading || buyers.loading || nearbyListings.loading;
  const hasData = !!model.activeListing || model.buyerRequests.length > 0 || model.nearbyListings.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={S.headerInk} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>My Listings & Market</Text>
          <Text style={styles.headerSub}>
            Voice can create listings, show buyers, and update your sell status.
          </Text>
        </View>
      </View>

      {isInitialLoading && !hasData ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={S.headerMuted} size="large" />
          <Text style={styles.loadingText}>Loading your market dashboard...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <MarketListingsView
            model={model}
            onBuyerPress={handleBuyerPress}
            onListingAction={handleListingAction}
            onRefreshPress={handleRefresh}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: S.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: S.headerCard,
    borderBottomWidth: 1,
    borderBottomColor: S.line,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAF1DD",
  },
  headerCopy: {
    flex: 1,
    paddingTop: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: S.headerInk,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    color: S.headerMuted,
    fontWeight: "600",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "700",
    color: S.headerMuted,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 140,
  },
});

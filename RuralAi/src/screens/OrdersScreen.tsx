/**
 * Orders Screen — view trade orders, create listings, manage orders.
 * Integrates: GET /agriculture/orders, POST listings/:id/order, PUT orders/:id
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useOrders, useMyListings, useHealthCheck } from "../hooks/useData";
import { supplyChainApi } from "../services/api";

export default function OrdersScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const orders = useOrders("farmer");
  const listings = useMyListings();
  const isOnline = health.data?.status === "ok";
  const [tab, setTab] = useState<"orders" | "listings">("orders");

  const orderList = (orders.data as any)?.orders ?? [];
  const listingList = (listings.data as any)?.listings ?? [];

  const handleUpdateOrder = useCallback(async (orderId: string, status: string) => {
    try {
      await supplyChainApi.updateOrder(orderId, { status });
      Alert.alert("Updated", `Order ${status}`);
      orders.refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not update");
    }
  }, []);

  const handleUpdateListing = useCallback(async (listingId: string, status: string) => {
    try {
      await supplyChainApi.updateListingStatus(listingId, status);
      Alert.alert("Updated", `Listing marked ${status}`);
      listings.refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not update");
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Orders & Listings</Text>
        <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === "orders" && styles.tabActive]} onPress={() => setTab("orders")}>
          <Text style={[styles.tabText, tab === "orders" && styles.tabTextActive]}>Orders ({orderList.length})</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "listings" && styles.tabActive]} onPress={() => setTab("listings")}>
          <Text style={[styles.tabText, tab === "listings" && styles.tabTextActive]}>My Listings ({listingList.length})</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === "orders" ? (
          orders.loading ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 40 }} />
          ) : orderList.length > 0 ? orderList.map((o: any) => (
            <View key={o.order_id ?? o.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.statusBadge, { backgroundColor: o.status === "confirmed" ? colors.successTint : o.status === "pending" ? colors.warnTint : colors.primaryTint }]}>
                  <Text style={[styles.statusText, { color: o.status === "confirmed" ? colors.success : o.status === "pending" ? colors.warn : colors.primary }]}>
                    {(o.status ?? "pending").toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.cardDate}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : ""}</Text>
              </View>
              <Text style={styles.cardTitle}>{o.crop_type ?? "Produce"} — {o.quantity_kg ?? 0}kg</Text>
              <Text style={styles.cardSub}>₹{o.offered_price ?? o.price ?? 0}/q • Buyer: {o.buyer_name ?? "Unknown"}</Text>
              {o.status === "pending" && (
                <View style={styles.actionRow}>
                  <Pressable style={[styles.actionBtn, { backgroundColor: colors.successTint }]} onPress={() => handleUpdateOrder(o.order_id ?? o.id, "confirmed")}>
                    <Ionicons name="checkmark" size={14} color={colors.success} />
                    <Text style={[styles.actionText, { color: colors.success }]}>Accept</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => handleUpdateOrder(o.order_id ?? o.id, "rejected")}>
                    <Ionicons name="close" size={14} color={colors.danger} />
                    <Text style={[styles.actionText, { color: colors.danger }]}>Reject</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySub}>Create a listing to receive orders from buyers</Text>
            </View>
          )
        ) : (
          listings.loading ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 40 }} />
          ) : listingList.length > 0 ? listingList.map((l: any) => (
            <View key={l.listing_id ?? l.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.statusBadge, { backgroundColor: l.status === "active" ? colors.successTint : colors.warnTint }]}>
                  <Text style={[styles.statusText, { color: l.status === "active" ? colors.success : colors.warn }]}>
                    {(l.status ?? "active").toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.cardDate}>{l.created_at ? new Date(l.created_at).toLocaleDateString() : ""}</Text>
              </View>
              <Text style={styles.cardTitle}>{l.crop_type} — {l.quantity_kg}kg</Text>
              <Text style={styles.cardSub}>₹{l.price_per_kg ?? l.asking_price ?? 0}/kg • {l.quality_grade ?? "Standard"}</Text>
              {l.status === "active" && (
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#FEE2E2", alignSelf: "flex-start" }]}
                  onPress={() => handleUpdateListing(l.listing_id ?? l.id, "cancelled")}
                >
                  <Ionicons name="close-circle" size={14} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Cancel</Text>
                </Pressable>
              )}
            </View>
          )) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="storefront-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyTitle}>No listings</Text>
              <Text style={styles.emptySub}>Create a produce listing to start selling</Text>
            </View>
          )
        )}

        {/* Create listing CTA */}
        <Pressable style={styles.cta} onPress={() => nav.navigate("CreateListing")}>
          <Ionicons name="add-circle" size={20} color="#FFF" />
          <Text style={styles.ctaText}>Create New Listing</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: "800", color: colors.muted },
  tabTextActive: { color: "#FFF" },
  content: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "900", color: colors.ink },
  cardSub: { fontSize: 11, fontWeight: "600", color: colors.muted },
  cardDate: { fontSize: 10, fontWeight: "600", color: colors.muted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  actionText: { fontSize: 12, fontWeight: "800" },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: colors.ink },
  emptySub: { fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center" },
  cta: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
});

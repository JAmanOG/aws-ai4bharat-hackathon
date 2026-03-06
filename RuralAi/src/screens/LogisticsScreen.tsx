/**
 * Logistics Screen — book transport, view requests, estimate costs.
 * Integrates: POST /agriculture/logistics, GET logistics, GET vehicles, POST estimate
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
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useTransportRequests, useVehicleTypes, useHealthCheck } from "../hooks/useData";
import { logisticsApi } from "../services/api";

export default function LogisticsScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const requests = useTransportRequests();
  const vehicles = useVehicleTypes();
  const isOnline = health.data?.status === "ok";

  const [showForm, setShowForm] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [quantity, setQuantity] = useState("");
  const [estimate, setEstimate] = useState<any>(null);
  const [booking, setBooking] = useState(false);

  const requestList = (requests.data as any)?.requests ?? (requests.data as any)?.logistics ?? [];
  const vehicleList = (vehicles.data as any)?.vehicles ?? (vehicles.data as any)?.vehicle_types ?? [];

  const handleEstimate = useCallback(async () => {
    if (!origin.trim() || !destination.trim()) return Alert.alert("Required", "Enter origin and destination");
    try {
      const res = await logisticsApi.estimateTransport({
        origin: { address: origin },
        destination: { address: destination },
        quantity_kg: Number(quantity) || 500,
      });
      setEstimate(res);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not estimate");
    }
  }, [origin, destination, quantity]);

  const handleBook = useCallback(async () => {
    setBooking(true);
    try {
      await logisticsApi.createTransport({
        origin: { address: origin },
        destination: { address: destination },
        quantity_kg: Number(quantity) || 500,
      });
      Alert.alert("Booked!", "Transport request created successfully");
      setShowForm(false);
      setOrigin("");
      setDestination("");
      setQuantity("");
      setEstimate(null);
      requests.refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not book");
    } finally {
      setBooking(false);
    }
  }, [origin, destination, quantity]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Transport & Logistics</Text>
        <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vehicle types */}
        {vehicleList.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 14 }}>
            {vehicleList.map((v: any, i: number) => (
              <View key={v.type ?? i} style={styles.vehicleChip}>
                <Ionicons name="car" size={14} color={colors.primary} />
                <Text style={styles.vehicleText}>{v.type ?? v.name ?? `Type ${i + 1}`}</Text>
                {v.capacity_kg && <Text style={styles.vehicleCap}>{v.capacity_kg}kg</Text>}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Booking form */}
        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Book Transport</Text>
            <TextInput style={styles.input} placeholder="Origin (village/mandi)" placeholderTextColor={colors.muted} value={origin} onChangeText={setOrigin} />
            <TextInput style={styles.input} placeholder="Destination" placeholderTextColor={colors.muted} value={destination} onChangeText={setDestination} />
            <TextInput style={styles.input} placeholder="Quantity (kg)" placeholderTextColor={colors.muted} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />

            {estimate && (
              <View style={styles.estimateCard}>
                <Text style={styles.estimateTitle}>Estimated Cost</Text>
                <Text style={styles.estimateValue}>₹{estimate.estimated_cost ?? estimate.cost ?? "—"}</Text>
                <Text style={styles.estimateSub}>{estimate.distance_km ? `${estimate.distance_km} km` : ""} • {estimate.estimated_time ?? ""}</Text>
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={handleEstimate}>
                <Ionicons name="calculator" size={16} color={colors.primary} />
                <Text style={styles.secondaryText}>Estimate</Text>
              </Pressable>
              <Pressable style={[styles.cta, { flex: 1 }]} onPress={handleBook} disabled={booking}>
                {booking ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                    <Text style={styles.ctaText}>Book</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.cta} onPress={() => setShowForm(true)}>
            <Ionicons name="car" size={20} color="#FFF" />
            <Text style={styles.ctaText}>Book Transport</Text>
          </Pressable>
        )}

        {/* Existing requests */}
        <Text style={styles.sectionTitle}>Your Requests</Text>
        {requests.loading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
        ) : requestList.length > 0 ? requestList.map((r: any) => (
          <View key={r.request_id ?? r.id} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={[styles.statusBadge, { backgroundColor: r.status === "completed" ? colors.successTint : r.status === "in_transit" ? colors.primaryTint : colors.warnTint }]}>
                <Text style={[styles.statusText, { color: r.status === "completed" ? colors.success : r.status === "in_transit" ? colors.primary : colors.warn }]}>
                  {(r.status ?? "pending").toUpperCase().replace("_", " ")}
                </Text>
              </View>
              <Text style={styles.dateText}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</Text>
            </View>
            <Text style={styles.cardTitle}>{r.origin?.address ?? "Origin"} → {r.destination?.address ?? "Dest"}</Text>
            <Text style={styles.cardSub}>{r.quantity_kg ?? 0}kg • ₹{r.cost ?? r.estimated_cost ?? "—"}</Text>
          </View>
        )) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="car-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No transport requests yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: "900", color: colors.ink },
  cardSub: { fontSize: 11, fontWeight: "600", color: colors.muted },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: colors.ink, marginTop: 10, marginBottom: 10 },
  input: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, fontSize: 13, fontWeight: "700", color: colors.ink, borderWidth: 1, borderColor: colors.border },
  vehicleChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  vehicleText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  vehicleCap: { fontSize: 10, fontWeight: "600", color: colors.muted },
  estimateCard: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 14, alignItems: "center", gap: 4 },
  estimateTitle: { fontSize: 11, fontWeight: "700", color: colors.muted },
  estimateValue: { fontSize: 22, fontWeight: "900", color: colors.primary },
  estimateSub: { fontSize: 10, fontWeight: "600", color: colors.muted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  dateText: { fontSize: 10, fontWeight: "600", color: colors.muted },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primaryTint },
  secondaryText: { fontSize: 13, fontWeight: "800", color: colors.primary },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
  emptyWrap: { alignItems: "center", paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 12, fontWeight: "600", color: colors.muted },
});

/**
 * Create Listing Screen — create new produce listing for supply chain.
 * Integrates: POST /agriculture/supply-chain/listings
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
import { supplyChainApi } from "../services/api";

const QUALITY_GRADES = ["A", "B", "C", "Standard"];
const CROP_TYPES = ["wheat", "rice", "cotton", "sugarcane", "maize", "pulses", "vegetables"];

export default function CreateListingScreen() {
  const nav = useNavigation<any>();
  const [cropType, setCropType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [quality, setQuality] = useState("A");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!cropType.trim()) return Alert.alert("Required", "Select or enter crop type");
    if (!quantity.trim()) return Alert.alert("Required", "Enter quantity in kg");
    if (!price.trim()) return Alert.alert("Required", "Enter price per kg");

    setCreating(true);
    try {
      await supplyChainApi.createListing({
        crop_type: cropType.trim(),
        quantity_kg: Number(quantity),
        price_per_kg: Number(price),
        quality_grade: quality,
        description: description.trim() || undefined,
      });
      Alert.alert("Listed!", "Your produce is now listed on the marketplace", [
        { text: "OK", onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not create listing");
    } finally {
      setCreating(false);
    }
  }, [cropType, quantity, price, quality, description, nav]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Create Listing</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Crop type selector */}
        <Text style={styles.label}>Crop Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CROP_TYPES.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, cropType === c && styles.chipActive]}
              onPress={() => setCropType(c)}
            >
              <Text style={[styles.chipText, cropType === c && { color: "#FFF" }]}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput
          style={styles.input}
          placeholder="Or type custom crop..."
          placeholderTextColor={colors.muted}
          value={cropType}
          onChangeText={setCropType}
        />

        {/* Quantity */}
        <Text style={styles.label}>Quantity (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 500"
          placeholderTextColor={colors.muted}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        {/* Price */}
        <Text style={styles.label}>Price per kg (₹)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 25"
          placeholderTextColor={colors.muted}
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />

        {/* Quality grade */}
        <Text style={styles.label}>Quality Grade</Text>
        <View style={styles.chipRow}>
          {QUALITY_GRADES.map((g) => (
            <Pressable
              key={g}
              style={[styles.chip, quality === g && styles.chipActive]}
              onPress={() => setQuality(g)}
            >
              <Text style={[styles.chipText, quality === g && { color: "#FFF" }]}>{g}</Text>
            </Pressable>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          placeholder="Any additional details..."
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        {/* Submit */}
        <Pressable style={styles.cta} onPress={handleCreate} disabled={creating}>
          {creating ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Ionicons name="storefront" size={18} color="#FFF" />
              <Text style={styles.ctaText}>List Produce</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },
  content: { padding: 16, paddingBottom: 100 },
  label: { fontSize: 13, fontWeight: "900", color: colors.ink, marginTop: 14, marginBottom: 8 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  input: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 14, fontWeight: "700", color: colors.ink, borderWidth: 1, borderColor: colors.border },
  cta: { marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
});

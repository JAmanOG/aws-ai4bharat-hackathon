import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  EconomicsHero,
  InsuranceClaimsView,
  useInsuranceModel,
} from "../components/EconomicsResponses";
import { useScreenContext } from "../context/ScreenContext";
import { useDemoScreenActions } from "../demo/DemoActions";
import { economicsApi } from "../services/api";
import { ruralPalette as P } from "../theme/ruralPalette";

export default function InsuranceClaimsScreen() {
  const nav = useNavigation<any>();
  const parentNav = nav.getParent();
  const screen = useScreenContext();
  const [showForm, setShowForm] = useState(false);
  const [cropType, setCropType] = useState("");
  const [lossDate, setLossDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const model = useInsuranceModel();

  const demoActions = useMemo(
    () => ({
      showForm: () => setShowForm(true),
      hideForm: () => setShowForm(false),
      toggleForm: () => setShowForm((value) => !value),
    }),
    [],
  );

  useDemoScreenActions("InsuranceClaims", demoActions);

  useEffect(() => {
    screen.update({
      screen: "InsuranceClaims",
      meta: {
        availableActions: "Ask claim status, review coverage, start new claim",
        coverageScheme: model.coverageScheme,
        coverageAmount: `${model.coverageAmount}`,
        claimReadiness: `${model.readinessScore}%`,
        latestClaimStatus: model.claims[0]?.status ?? "No recent claim",
      },
    });
  }, [
    model.claims,
    model.coverageAmount,
    model.coverageScheme,
    model.readinessScore,
    screen.update,
  ]);

  async function submitClaim() {
    if (!cropType.trim()) {
      Alert.alert("Required", "Enter the crop type first.");
      return;
    }

    setSubmitting(true);
    try {
      await economicsApi.createInsuranceClaim({
        crop_type: cropType.trim(),
        loss_date: lossDate.trim() || undefined,
        notes: notes.trim() || undefined,
        damage_signals: notes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        digilocker_consent: true,
      });
      setCropType("");
      setLossDate("");
      setNotes("");
      setShowForm(false);
      Alert.alert("Claim saved", "The crop damage claim has been created.", [
        { text: "OK", onPress: () => nav.replace("InsuranceClaims") },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Could not create the claim.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}
          hitSlop={10}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color={P.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Insurance & Claims</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <EconomicsHero
          prompt={model.prompt}
          intro={model.spokenText}
          onPress={() => parentNav?.navigate("Ask")}
        />

        <InsuranceClaimsView
          model={model}
          primaryAction={{
            label: showForm ? "Hide claim form" : "Start new claim",
            icon: showForm ? "chevron-up" : "add-circle",
            onPress: () => setShowForm((value) => !value),
          }}
        />

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New crop damage claim</Text>
            <TextInput
              style={styles.input}
              value={cropType}
              onChangeText={setCropType}
              placeholder="Crop type"
              placeholderTextColor={P.muted}
            />
            <TextInput
              style={styles.input}
              value={lossDate}
              onChangeText={setLossDate}
              placeholder="Loss date (YYYY-MM-DD)"
              placeholderTextColor={P.muted}
            />
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Damage notes or signals, separated by commas"
              placeholderTextColor={P.muted}
              multiline
              textAlignVertical="top"
            />

            <Pressable style={styles.submitButton} onPress={submitClaim} disabled={submitting}>
              <Text style={styles.submitButtonText}>{submitting ? "Submitting..." : "Submit claim"}</Text>
              <Ionicons name="send" size={18} color={P.ink} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
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
  headerTitle: {
    fontSize: 17,
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
  formCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    shadowColor: P.goldShadow,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: P.ink,
    marginBottom: 12,
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F9F4E8",
    borderWidth: 1,
    borderColor: P.lineSoft,
    fontSize: 14,
    fontWeight: "700",
    color: P.ink,
    marginBottom: 10,
  },
  notesInput: {
    minHeight: 100,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 22,
    paddingVertical: 14,
    backgroundColor: "#EFD27A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: P.ink,
  },
});

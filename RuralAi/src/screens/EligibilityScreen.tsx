import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  EconomicsHero,
  LoanEligibilityView,
  useLoanEligibilityModel,
} from "../components/EconomicsResponses";
import { useScreenContext } from "../context/ScreenContext";
import { ruralPalette as P } from "../theme/ruralPalette";

export default function EligibilityScreen() {
  const nav = useNavigation<any>();
  const parentNav = nav.getParent();
  const screen = useScreenContext();
  const model = useLoanEligibilityModel();

  useEffect(() => {
    screen.update({
      screen: "Eligibility",
      meta: {
        availableActions: "Ask for loan explanation, review scheme fit, check next documents",
        readinessScore: `${model.readinessScore}%`,
        visibleSchemeNames: model.offers.map((offer) => offer.title).join(", "),
        documentStatus: `${model.documentsReady}/${model.totalDocuments}`,
        profileSummary: model.profileSummary,
      },
    });
  }, [
    model.documentsReady,
    model.offers,
    model.profileSummary,
    model.readinessScore,
    model.totalDocuments,
    screen.update,
  ]);

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
        <Text style={styles.headerTitle}>Loan Eligibility</Text>
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

        <LoanEligibilityView
          model={model}
          primaryAction={{
            label: "Continue by voice",
            icon: "mic",
            onPress: () => parentNav?.navigate("Ask"),
          }}
        />
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
  },
});

import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  EconomicsHero,
  FinancialOverviewView,
  useFinancialOverviewModel,
} from "../components/EconomicsResponses";
import { useScreenContext } from "../context/ScreenContext";
import { ruralPalette as P } from "../theme/ruralPalette";

export default function SavingsNudgeScreen() {
  const nav = useNavigation<any>();
  const parentNav = nav.getParent();
  const screen = useScreenContext();
  const model = useFinancialOverviewModel();

  useEffect(() => {
    screen.update({
      screen: "SavingsNudge",
      meta: {
        availableActions: "Ask harvest summary, review savings split, compare cost and profit",
        harvestIncome: `${model.harvestIncome}`,
        savingsTarget: `${model.savingsTarget}`,
        visibleAllocationNames: model.allocations.map((allocation) => allocation.title).join(", "),
        harvestLabel: model.harvestLabel,
      },
    });
  }, [
    model.allocations,
    model.harvestIncome,
    model.harvestLabel,
    model.savingsTarget,
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
        <Text style={styles.headerTitle}>Financial Overview</Text>
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

        <FinancialOverviewView
          model={model}
          primaryAction={{
            label: "Ask for savings advice",
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

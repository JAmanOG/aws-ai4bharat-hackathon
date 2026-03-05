import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import ModuleScreen from "../screens/ModuleScreen";
import ActionScreen from "../screens/ActionScreen";
import MarketPricesScreen from "../screens/MarketPricesScreen";
import SchemesListScreen from "../screens/SchemesListScreen";
import SchemeDetailScreen from "../screens/SchemeDetailScreen";
import SymptomCheckerScreen from "../screens/SymptomCheckerScreen";
import AlertsScreen from "../screens/AlertsScreen";
import AgriMarketScreen from "../screens/AgriMarketScreen";
import KnowledgeDashboardScreen from "../screens/KnowledgeDashboardScreen";
import SavingsNudgeScreen from "../screens/SavingsNudgeScreen";
import EligibilityScreen from "../screens/EligibilityScreen";
import SyncStatusScreen from "../screens/SyncStatusScreen";
import SavedScreen from "../screens/SavedScreen";
import SavedDetailScreen from "../screens/SavedDetailScreen";

export type HomeStackParamList = {
  HomeMain: undefined;
  Module: { title: string };
  MarketPrices: { moduleTitle?: string } | undefined;
  SchemesList: { moduleTitle?: string } | undefined;
  SchemeDetail: { schemeId: string };
  SymptomChecker: undefined;
  Alerts: undefined;
  Action: { moduleTitle: string; actionTitle: string };
  AgriMarket: undefined;
  KnowledgeDashboard: undefined;
  SavingsNudge: undefined;
  Eligibility: undefined;
  SyncStatus: undefined;
  Saved: undefined;
  SavedDetail: { itemId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Module" component={ModuleScreen} />
      <Stack.Screen name="MarketPrices" component={MarketPricesScreen} />
      <Stack.Screen name="SchemesList" component={SchemesListScreen} />
      <Stack.Screen name="SchemeDetail" component={SchemeDetailScreen} />
      <Stack.Screen name="SymptomChecker" component={SymptomCheckerScreen} />
      <Stack.Screen name="Alerts" component={AlertsScreen} />
      <Stack.Screen name="Action" component={ActionScreen} />
      <Stack.Screen name="AgriMarket" component={AgriMarketScreen} />
      <Stack.Screen name="KnowledgeDashboard" component={KnowledgeDashboardScreen} />
      <Stack.Screen name="SavingsNudge" component={SavingsNudgeScreen} />
      <Stack.Screen name="Eligibility" component={EligibilityScreen} />
      <Stack.Screen name="SyncStatus" component={SyncStatusScreen} />
      <Stack.Screen name="Saved" component={SavedScreen} />
      <Stack.Screen name="SavedDetail" component={SavedDetailScreen} />
    </Stack.Navigator>
  );
}

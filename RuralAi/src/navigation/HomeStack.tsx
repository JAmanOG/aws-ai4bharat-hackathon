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
import BargainingGroupsScreen from "../screens/BargainingGroupsScreen";
import OrdersScreen from "../screens/OrdersScreen";
import LogisticsScreen from "../screens/LogisticsScreen";
import CourseDetailScreen from "../screens/CourseDetailScreen";
import PeerGroupDetailScreen from "../screens/PeerGroupDetailScreen";
import InsuranceClaimsScreen from "../screens/InsuranceClaimsScreen";
import PracticeLogScreen from "../screens/PracticeLogScreen";
import CreateListingScreen from "../screens/CreateListingScreen";
import VoiceDrivenScreen from "../screens/VoiceDrivenScreen";
import BusinessDirectoryScreen from "../screens/BusinessDirectoryScreen";
import GovtPortalsScreen from "../screens/GovtPortalsScreen";
import HealthDashboardScreen from "../screens/HealthDashboardScreen";
import LivelihoodScreen from "../screens/LivelihoodScreen";
import VoiceRoomsScreen from "../screens/VoiceRoomsScreen";
import VoiceRoomScreen from "../screens/VoiceRoomScreen";
import KnowledgeResourcesScreen from "../screens/KnowledgeResourcesScreen";

export type HomeStackParamList = {
  HomeMain: undefined;
  Module: { title: string };
  MarketPrices: { moduleTitle?: string; crop?: string; location?: string } | undefined;
  SchemesList: { moduleTitle?: string } | undefined;
  SchemeDetail: { schemeId: string };
  SymptomChecker: undefined;
  Alerts: undefined;
  Action: { moduleTitle: string; actionTitle: string };
  AgriMarket: { crop?: string; tab?: "crops" | "historical"; compareCrop?: string; location?: string } | undefined;
  KnowledgeDashboard: undefined;
  SavingsNudge: undefined;
  Eligibility: undefined;
  SyncStatus: undefined;
  Saved: undefined;
  SavedDetail: { itemId: string };
  BargainingGroups: undefined;
  Orders: { crop?: string; location?: string } | undefined;
  Logistics: undefined;
  CourseDetail: { courseId: string; courseName?: string; enrolled?: boolean };
  PeerGroupDetail: { groupId: string; groupName?: string; isMember?: boolean };
  InsuranceClaims: undefined;
  PracticeLog: undefined;
  CreateListing: undefined;
  VoiceDriven: undefined;
  BusinessDirectory: undefined;
  GovtPortals: undefined;
  HealthDashboard: undefined;
  Livelihood: undefined;
  KnowledgeResources: { initialTab?: "all" | "videos" | "articles"; query?: string; language?: string } | undefined;
  VoiceRooms: undefined;
  VoiceRoom: { roomId: string };
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
      <Stack.Screen name="BargainingGroups" component={BargainingGroupsScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="Logistics" component={LogisticsScreen} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
      <Stack.Screen name="PeerGroupDetail" component={PeerGroupDetailScreen} />
      <Stack.Screen name="InsuranceClaims" component={InsuranceClaimsScreen} />
      <Stack.Screen name="PracticeLog" component={PracticeLogScreen} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} />
      <Stack.Screen name="VoiceDriven" component={VoiceDrivenScreen} />
      <Stack.Screen name="BusinessDirectory" component={BusinessDirectoryScreen} />
      <Stack.Screen name="GovtPortals" component={GovtPortalsScreen} />
      <Stack.Screen name="HealthDashboard" component={HealthDashboardScreen} />
      <Stack.Screen name="Livelihood" component={LivelihoodScreen} />
      <Stack.Screen name="KnowledgeResources" component={KnowledgeResourcesScreen} />
      <Stack.Screen name="VoiceRooms" component={VoiceRoomsScreen} />
      <Stack.Screen name="VoiceRoom" component={VoiceRoomScreen} />
    </Stack.Navigator>
  );
}

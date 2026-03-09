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
import { withScreenMotion } from "../components/motion/ScreenMotion";

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

const AnimatedHomeScreen = withScreenMotion(HomeScreen);
const AnimatedModuleScreen = withScreenMotion(ModuleScreen);
const AnimatedActionScreen = withScreenMotion(ActionScreen);
const AnimatedMarketPricesScreen = withScreenMotion(MarketPricesScreen);
const AnimatedSchemesListScreen = withScreenMotion(SchemesListScreen);
const AnimatedSchemeDetailScreen = withScreenMotion(SchemeDetailScreen);
const AnimatedSymptomCheckerScreen = withScreenMotion(SymptomCheckerScreen);
const AnimatedAlertsScreen = withScreenMotion(AlertsScreen);
const AnimatedAgriMarketScreen = withScreenMotion(AgriMarketScreen);
const AnimatedKnowledgeDashboardScreen = withScreenMotion(KnowledgeDashboardScreen);
const AnimatedSavingsNudgeScreen = withScreenMotion(SavingsNudgeScreen);
const AnimatedEligibilityScreen = withScreenMotion(EligibilityScreen);
const AnimatedSyncStatusScreen = withScreenMotion(SyncStatusScreen);
const AnimatedSavedScreen = withScreenMotion(SavedScreen);
const AnimatedSavedDetailScreen = withScreenMotion(SavedDetailScreen);
const AnimatedBargainingGroupsScreen = withScreenMotion(BargainingGroupsScreen);
const AnimatedOrdersScreen = withScreenMotion(OrdersScreen);
const AnimatedLogisticsScreen = withScreenMotion(LogisticsScreen);
const AnimatedCourseDetailScreen = withScreenMotion(CourseDetailScreen);
const AnimatedPeerGroupDetailScreen = withScreenMotion(PeerGroupDetailScreen);
const AnimatedInsuranceClaimsScreen = withScreenMotion(InsuranceClaimsScreen);
const AnimatedPracticeLogScreen = withScreenMotion(PracticeLogScreen);
const AnimatedCreateListingScreen = withScreenMotion(CreateListingScreen);
const AnimatedVoiceDrivenScreen = withScreenMotion(VoiceDrivenScreen);
const AnimatedBusinessDirectoryScreen = withScreenMotion(BusinessDirectoryScreen);
const AnimatedGovtPortalsScreen = withScreenMotion(GovtPortalsScreen);
const AnimatedHealthDashboardScreen = withScreenMotion(HealthDashboardScreen);
const AnimatedLivelihoodScreen = withScreenMotion(LivelihoodScreen);
const AnimatedKnowledgeResourcesScreen = withScreenMotion(KnowledgeResourcesScreen);
const AnimatedVoiceRoomsScreen = withScreenMotion(VoiceRoomsScreen);
const AnimatedVoiceRoomScreen = withScreenMotion(VoiceRoomScreen);

export default function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 240,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="HomeMain" component={AnimatedHomeScreen} />
      <Stack.Screen name="Module" component={AnimatedModuleScreen} />
      <Stack.Screen name="MarketPrices" component={AnimatedMarketPricesScreen} />
      <Stack.Screen name="SchemesList" component={AnimatedSchemesListScreen} />
      <Stack.Screen name="SchemeDetail" component={AnimatedSchemeDetailScreen} />
      <Stack.Screen name="SymptomChecker" component={AnimatedSymptomCheckerScreen} />
      <Stack.Screen name="Alerts" component={AnimatedAlertsScreen} />
      <Stack.Screen name="Action" component={AnimatedActionScreen} />
      <Stack.Screen name="AgriMarket" component={AnimatedAgriMarketScreen} />
      <Stack.Screen name="KnowledgeDashboard" component={AnimatedKnowledgeDashboardScreen} />
      <Stack.Screen name="SavingsNudge" component={AnimatedSavingsNudgeScreen} />
      <Stack.Screen name="Eligibility" component={AnimatedEligibilityScreen} />
      <Stack.Screen name="SyncStatus" component={AnimatedSyncStatusScreen} />
      <Stack.Screen name="Saved" component={AnimatedSavedScreen} />
      <Stack.Screen name="SavedDetail" component={AnimatedSavedDetailScreen} />
      <Stack.Screen name="BargainingGroups" component={AnimatedBargainingGroupsScreen} />
      <Stack.Screen name="Orders" component={AnimatedOrdersScreen} />
      <Stack.Screen name="Logistics" component={AnimatedLogisticsScreen} />
      <Stack.Screen name="CourseDetail" component={AnimatedCourseDetailScreen} />
      <Stack.Screen name="PeerGroupDetail" component={AnimatedPeerGroupDetailScreen} />
      <Stack.Screen name="InsuranceClaims" component={AnimatedInsuranceClaimsScreen} />
      <Stack.Screen name="PracticeLog" component={AnimatedPracticeLogScreen} />
      <Stack.Screen name="CreateListing" component={AnimatedCreateListingScreen} />
      <Stack.Screen name="VoiceDriven" component={AnimatedVoiceDrivenScreen} />
      <Stack.Screen name="BusinessDirectory" component={AnimatedBusinessDirectoryScreen} />
      <Stack.Screen name="GovtPortals" component={AnimatedGovtPortalsScreen} />
      <Stack.Screen name="HealthDashboard" component={AnimatedHealthDashboardScreen} />
      <Stack.Screen name="Livelihood" component={AnimatedLivelihoodScreen} />
      <Stack.Screen name="KnowledgeResources" component={AnimatedKnowledgeResourcesScreen} />
      <Stack.Screen name="VoiceRooms" component={AnimatedVoiceRoomsScreen} />
      <Stack.Screen name="VoiceRoom" component={AnimatedVoiceRoomScreen} />
    </Stack.Navigator>
  );
}

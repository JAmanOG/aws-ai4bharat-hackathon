import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import ModuleScreen from "../screens/ModuleScreen";
import ActionScreen from "../screens/ActionScreen";
import MarketPricesScreen from "../screens/MarketPricesScreen";
import SchemesListScreen from "../screens/SchemesListScreen";
import SchemeDetailScreen from "../screens/SchemeDetailScreen";

export type HomeStackParamList = {
  HomeMain: undefined;
  Module: { title: string };
  MarketPrices: { moduleTitle?: string } | undefined;
  SchemesList: { moduleTitle?: string } | undefined;
  SchemeDetail: { schemeId: string };
  Action: { moduleTitle: string; actionTitle: string };
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
      <Stack.Screen name="Action" component={ActionScreen} />
    </Stack.Navigator>
  );
}
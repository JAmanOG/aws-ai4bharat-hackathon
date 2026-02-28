import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import ModuleScreen from "../screens/ModuleScreen";
import ActionScreen from "../screens/ActionScreen";

export type HomeStackParamList = {
  HomeMain: undefined;
  Module: { title: string };
  Action: { moduleTitle: string; actionTitle: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Module" component={ModuleScreen} />
      <Stack.Screen name="Action" component={ActionScreen} />
    </Stack.Navigator>
  );
}
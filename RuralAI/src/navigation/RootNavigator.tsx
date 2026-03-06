import React, { useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";
import HomeScreen from "../screens/HomeScreen";
import AskScreen from "../screens/AskScreen";
import CommunityScreen from "../screens/CommunityScreen";
import SavedScreen from "../screens/SavedScreen";
import ProfileScreen from "../screens/ProfileScreen";
import CustomTabBar from "./CustomTabBar";
import HomeStack from "./HomeStack";
import SchemesListScreen from "../screens/SchemesListScreen";
import SchemeDetailScreen from "../screens/SchemeDetailScreen";
import ActionScreen from "../screens/ActionScreen";
import VoiceRoomScreen from "../screens/VoiceRoomScreen";
import ModuleScreen from "../screens/ModuleScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Ask" component={AskScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showSplash ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={Tabs} />
          <Stack.Screen name="Module" component={ModuleScreen} />
          <Stack.Screen name="SchemesList" component={SchemesListScreen} />
          <Stack.Screen name="SchemeDetail" component={SchemeDetailScreen} />
          <Stack.Screen name="Action" component={ActionScreen} />
          <Stack.Screen name="VoiceRoom" component={VoiceRoomScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

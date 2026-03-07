import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getFocusedRouteNameFromRoute, useNavigation } from "@react-navigation/native";

import SplashScreen from "../screens/SplashScreen";
import LoginScreen from "../screens/LoginScreen";
import AskScreen from "../screens/AskScreen";
import ProfileScreen from "../screens/ProfileScreen";
import CustomTabBar from "./CustomTabBar";
import HomeStack from "./HomeStack";
import { useAuth } from "../contexts/AuthContext";

// Community still accessible from Ask top icon (stack screen)
import CommunityScreen from "../screens/CommunityScreen";

// Voice-first system
import { VoiceProvider, useVoice } from "../voice/VoiceContext";
import { ScreenProvider } from "../context/ScreenContext";
import VoiceOverlay from "../voice/VoiceOverlay";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const FULLSCREEN_HOME_ROUTES = new Set(["VoiceRooms", "VoiceRoom"]);

function shouldHideTabBar(state: { index: number; routes: Array<any> }) {
  const activeRoute = state.routes[state.index];
  if (!activeRoute || activeRoute.name !== "Home") {
    return false;
  }

  const nestedRouteName = getFocusedRouteNameFromRoute(activeRoute);
  return nestedRouteName ? FULLSCREEN_HOME_ROUTES.has(nestedRouteName) : false;
}

function Tabs() {
  return (
    <Tab.Navigator
      initialRouteName="Ask"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (shouldHideTabBar(props.state) ? null : <CustomTabBar {...props} />)}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Ask" component={AskScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function OverlayHost({ activeRouteName }: { activeRouteName: string | null }) {
  const hideOverlay = activeRouteName ? FULLSCREEN_HOME_ROUTES.has(activeRouteName) : false;
  return <VoiceOverlay hidden={hideOverlay} />;
}

/**
 * NavigationWirer — hooks VoiceContext.navigateRef into React Navigation.
 * Placed inside NavigationContainer so useNavigation is available.
 */
function NavigationWirer() {
  const nav = useNavigation<any>();
  const { navigateRef } = useVoice();

  const doNavigate = useCallback(
    (screen: string, params?: any) => {
      try {
        // Try direct screen name first (works for HomeStack screens)
        nav.navigate("Main", {
          screen: "Home",
          params: { screen, params },
        });
      } catch {
        // Fallback: just navigate directly
        try {
          nav.navigate(screen, params);
        } catch {}
      }
    },
    [nav]
  );

  useEffect(() => {
    navigateRef.current = doNavigate;
  }, [doNavigate, navigateRef]);

  return null;
}

/**
 * AuthenticatedApp — main app with VoiceOverlay on top.
 */
function AuthenticatedApp({ activeRouteName }: { activeRouteName: string | null }) {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={Tabs} />
        <Stack.Screen name="Community" component={CommunityScreen} />
      </Stack.Navigator>
      <NavigationWirer />
      <OverlayHost activeRouteName={activeRouteName} />
    </View>
  );
}

export default function RootNavigator({ activeRouteName = null }: { activeRouteName?: string | null }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // Show splash while loading auth state or during splash timer
  if (isLoading || showSplash) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  // Not authenticated → show Login screen
  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  // Authenticated → show main app with voice overlay
  return (
    <ScreenProvider>
    <VoiceProvider>
      <AuthenticatedApp activeRouteName={activeRouteName} />
    </VoiceProvider>
    </ScreenProvider>
  );
}

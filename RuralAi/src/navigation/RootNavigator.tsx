import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getFocusedRouteNameFromRoute, useNavigation } from "@react-navigation/native";

import SplashScreen from "../screens/SplashScreen";
import LanguageSelectScreen from "../screens/LanguageSelectScreen";
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
import { normalizeAppLanguage, readStoredLanguagePreference, writeStoredLanguagePreference } from "../utils/languagePreference";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const TAB_BAR_HIDDEN_HOME_ROUTES = new Set(["VoiceRooms", "VoiceRoom", "SymptomChecker"]);

function shouldHideTabBar(state: { index: number; routes: Array<any> }) {
  const activeRoute = state.routes[state.index];
  if (!activeRoute || activeRoute.name !== "Home") {
    return false;
  }

  const nestedRouteName = getFocusedRouteNameFromRoute(activeRoute);
  return nestedRouteName ? TAB_BAR_HIDDEN_HOME_ROUTES.has(nestedRouteName) : false;
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
 * AuthenticatedApp — main app shell.
 */
function AuthenticatedApp() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={Tabs} />
        <Stack.Screen name="Community" component={CommunityScreen} />
      </Stack.Navigator>
      <NavigationWirer />
    </View>
  );
}

export default function RootNavigator({ activeRouteName = null }: { activeRouteName?: string | null }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [languageReady, setLanguageReady] = useState(false);
  const [languageJourneyDone, setLanguageJourneyDone] = useState(false);
  const [initialLanguage, setInitialLanguage] = useState("hi");

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (showSplash) {
      setLanguageJourneyDone(false);
    }
  }, [showSplash]);

  useEffect(() => {
    let cancelled = false;

    if (isLoading) return () => {
      cancelled = true;
    };

    if (user?.preferredLanguage) {
      const normalized = normalizeAppLanguage(user.preferredLanguage);
      writeStoredLanguagePreference(normalized).catch(() => {});
      setInitialLanguage(normalized);
      setLanguageReady(true);
      return () => {
        cancelled = true;
      };
    }

    readStoredLanguagePreference()
      .then((stored) => {
        if (cancelled) return;
        setInitialLanguage(stored ?? "hi");
        setLanguageReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setInitialLanguage("hi");
        setLanguageReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoading, user?.preferredLanguage]);

  const handleLanguageContinue = useCallback((language: string) => {
    const normalized = normalizeAppLanguage(language);
    setInitialLanguage(normalized);
    setLanguageJourneyDone(true);
    writeStoredLanguagePreference(normalized).catch(() => {});
  }, []);

  // Show splash while loading auth state or during splash timer
  if (isLoading || showSplash || !languageReady) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  if (!languageJourneyDone) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="LanguageSelect">
          {() => <LanguageSelectScreen initialLanguage={initialLanguage} onContinue={handleLanguageContinue} />}
        </Stack.Screen>
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
      <AuthenticatedApp />
    </VoiceProvider>
    </ScreenProvider>
  );
}

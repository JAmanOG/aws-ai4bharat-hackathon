import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ruralPalette as P } from "../theme/ruralPalette";

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ["home-outline", "home"],
  Ask: ["mic-outline", "mic"],
  Profile: ["person-outline", "person"],
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const pressTab = (routeName: string, routeKey: string, isFocused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const homeRoute = state.routes.find((route) => route.name === "Home");
  const askRoute = state.routes.find((route) => route.name === "Ask");
  const profileRoute = state.routes.find((route) => route.name === "Profile");

  if (!homeRoute || !askRoute || !profileRoute) return null;

  const buildLabel = (routeName: string, routeKey: string) =>
    descriptors[routeKey]?.options?.tabBarLabel?.toString() ?? routeName;

  const homeFocused = state.index === state.routes.findIndex((route) => route.key === homeRoute.key);
  const askFocused = state.index === state.routes.findIndex((route) => route.key === askRoute.key);
  const profileFocused = state.index === state.routes.findIndex((route) => route.key === profileRoute.key);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => pressTab(homeRoute.name, homeRoute.key, homeFocused)}
          style={({ pressed }) => [styles.sideItem, pressed && styles.pressed]}
        >
          <Ionicons
            name={(homeFocused ? ICONS.Home[1] : ICONS.Home[0]) as any}
            size={30}
            color={homeFocused ? P.goldDark : P.tabInactive}
          />
          <Text style={[styles.sideLabel, homeFocused && styles.sideLabelActive]}>
            {buildLabel(homeRoute.name, homeRoute.key)}
          </Text>
        </Pressable>

        <View style={styles.askSlot}>
          <Pressable
            onPress={() => pressTab(askRoute.name, askRoute.key, askFocused)}
            style={({ pressed }) => [styles.askButton, pressed && styles.askPressed]}
          >
            <View style={styles.askRing}>
              <View style={styles.askCore}>
                <Ionicons name={(askFocused ? ICONS.Ask[1] : ICONS.Ask[0]) as any} size={34} color={P.surface} />
              </View>
            </View>
          </Pressable>
          <Text style={[styles.askLabel, askFocused && styles.askLabelActive]}>
            {buildLabel(askRoute.name, askRoute.key)}
          </Text>
        </View>

        <Pressable
          onPress={() => pressTab(profileRoute.name, profileRoute.key, profileFocused)}
          style={({ pressed }) => [styles.sideItem, pressed && styles.pressed]}
        >
          <Ionicons
            name={(profileFocused ? ICONS.Profile[1] : ICONS.Profile[0]) as any}
            size={30}
            color={profileFocused ? P.goldDark : P.tabInactive}
          />
          <Text style={[styles.sideLabel, profileFocused && styles.sideLabelActive]}>
            {buildLabel(profileRoute.name, profileRoute.key)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    backgroundColor: "transparent",
  },
  bar: {
    height: 106,
    borderRadius: 34,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.lineSoft,
    paddingHorizontal: 24,
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    shadowColor: "#A79B82",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  sideItem: {
    width: 88,
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
  },
  sideLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: P.tabInactive,
  },
  sideLabelActive: {
    color: P.goldDark,
  },
  askSlot: {
    alignItems: "center",
    marginTop: -62,
  },
  askButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  askPressed: {
    transform: [{ scale: 0.97 }],
  },
  askRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: P.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: P.goldShadow,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  askCore: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: P.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  askLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: P.goldDark,
  },
  askLabelActive: {
    color: P.goldDark,
  },
  pressed: {
    opacity: 0.82,
  },
});

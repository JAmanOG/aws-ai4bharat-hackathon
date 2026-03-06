/**
 * Custom bottom tab bar — floating design with elevated center mic button.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

const ICONS: Record<string, [string, string]> = {
  Home: ["home-outline", "home"],
  Ask: ["chatbubble-ellipses-outline", "chatbubble-ellipses"],
  Profile: ["person-outline", "person"],
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const routes = state.routes;

  const handlePress = (routeName: string, routeKey: string, isFocused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(routeName);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {routes.map((route, index) => {
          const isFocused = state.index === index;
          const label = descriptors[route.key]?.options?.tabBarLabel?.toString() ?? route.name;

          const [outlineIcon, filledIcon] = ICONS[route.name] ?? ["ellipse-outline", "ellipse"];
          return (
            <Pressable
              key={route.key}
              onPress={() => handlePress(route.name, route.key, isFocused)}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
            >
              <Ionicons
                name={(isFocused ? filledIcon : outlineIcon) as any}
                size={22}
                color={isFocused ? colors.primary : colors.muted}
              />
              <Text style={[styles.label, { color: isFocused ? colors.primary : colors.muted }]}>
                {label}
              </Text>
              {isFocused && <View style={styles.activeDot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "transparent", paddingHorizontal: 16, paddingBottom: 12 },
  bar: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  item: { alignItems: "center", justifyContent: "flex-end", gap: 4, minWidth: 64 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  activeDot: { marginTop: 4, width: 20, height: 3, borderRadius: 2, backgroundColor: colors.primary },
});

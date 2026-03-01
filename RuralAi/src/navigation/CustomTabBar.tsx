import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

const ICONS: Record<string, any> = {
  Home: "home-outline",
  Profile: "person-outline",
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

          // Center ASK button (big mic)
          if (route.name === "Ask") {
            return (
              <View key={route.key} style={styles.centerSlot}>
                <Pressable
                  onPress={() => handlePress(route.name, route.key, isFocused)}
                  style={({ pressed }) => [styles.centerBtn, pressed && { opacity: 0.9 }]}
                >
                  <Ionicons name="mic" size={26} color={colors.ink} />
                </Pressable>
                <Text style={[styles.label, { marginTop: 10, color: isFocused ? colors.primary : colors.muted }]}>
                  {label}
                </Text>
              </View>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={() => handlePress(route.name, route.key, isFocused)}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
            >
              <Ionicons
                name={ICONS[route.name] ?? "ellipse-outline"}
                size={22}
                color={isFocused ? colors.primary : colors.muted}
              />
              <Text style={[styles.label, { color: isFocused ? colors.primary : colors.muted }]}>
                {label}
              </Text>
              <View style={[styles.activeDot, { backgroundColor: isFocused ? colors.primary : "transparent" }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "transparent", paddingHorizontal: 14, paddingBottom: 10 },
  bar: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12, // bigger bar
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  item: { width: 92, alignItems: "center", justifyContent: "flex-end", gap: 8 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  activeDot: { marginTop: 6, width: 28, height: 3, borderRadius: 99 },

  centerSlot: { width: 110, alignItems: "center", justifyContent: "flex-end" },
  centerBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -36,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
});
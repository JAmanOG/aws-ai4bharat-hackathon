import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

const ICONS: Record<string, any> = {
<<<<<<< HEAD
  Home: "home-outline",
=======
  Ask: "help-circle-outline",
  Community: "people-outline",
  Home: "home-outline",
  Saved: "bookmark-outline",
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
  Profile: "person-outline",
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
<<<<<<< HEAD
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
=======
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          // Center floating HOME button
          if (route.name === "Home") {
            return (
              <View key={route.key} style={styles.centerSlot}>
                <Pressable onPress={onPress} style={({ pressed }) => [styles.centerBtn, pressed && { opacity: 0.9 }]}>
                  <Ionicons name={ICONS[route.name]} size={22} color={colors.ink} />
                </Pressable>
                <Text style={[styles.label, { marginTop: 8, color: isFocused ? colors.primary : colors.muted }]}>
                  {options.tabBarLabel?.toString() ?? route.name}
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
                </Text>
              </View>
            );
          }

          return (
            <Pressable
              key={route.key}
<<<<<<< HEAD
              onPress={() => handlePress(route.name, route.key, isFocused)}
=======
              onPress={onPress}
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
            >
              <Ionicons
                name={ICONS[route.name] ?? "ellipse-outline"}
<<<<<<< HEAD
                size={22}
                color={isFocused ? colors.primary : colors.muted}
              />
              <Text style={[styles.label, { color: isFocused ? colors.primary : colors.muted }]}>
                {label}
              </Text>
              <View style={[styles.activeDot, { backgroundColor: isFocused ? colors.primary : "transparent" }]} />
=======
                size={20}
                color={isFocused ? colors.primary : colors.muted}
              />
              <Text style={[styles.label, { color: isFocused ? colors.primary : colors.muted }]}>
                {options.tabBarLabel?.toString() ?? route.name}
              </Text>
              {isFocused ? <View style={styles.activeDot} /> : <View style={styles.activeDotHidden} />}
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  wrap: { backgroundColor: "transparent", paddingHorizontal: 14, paddingBottom: 10 },
  bar: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12, // bigger bar
=======
  wrap: {
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  bar: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
<<<<<<< HEAD
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
=======
  item: {
    width: 64,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  activeDot: {
    marginTop: 6,
    width: 26,
    height: 3,
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  activeDotHidden: {
    marginTop: 6,
    width: 26,
    height: 3,
    borderRadius: 99,
    backgroundColor: "transparent",
  },
  centerSlot: {
    width: 84,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
<<<<<<< HEAD
    elevation: 7,
=======
    elevation: 6,
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
  },
});
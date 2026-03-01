import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

const ICONS: Record<string, any> = {
  Ask: "help-circle-outline",
  Community: "people-outline",
  Home: "home-outline",
  Saved: "bookmark-outline",
  Profile: "person-outline",
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
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
                </Text>
              </View>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
            >
              <Ionicons
                name={ICONS[route.name] ?? "ellipse-outline"}
                size={20}
                color={isFocused ? colors.primary : colors.muted}
              />
              <Text style={[styles.label, { color: isFocused ? colors.primary : colors.muted }]}>
                {options.tabBarLabel?.toString() ?? route.name}
              </Text>
              {isFocused ? <View style={styles.activeDot} /> : <View style={styles.activeDotHidden} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
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
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
});
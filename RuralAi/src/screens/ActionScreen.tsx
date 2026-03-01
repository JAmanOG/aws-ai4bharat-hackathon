import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";

export default function ActionScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const moduleTitle = route?.params?.moduleTitle ?? "Module";
  const actionTitle = route?.params?.actionTitle ?? "Action";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>{actionTitle}</Text>
          <Text style={styles.hSub}>{moduleTitle}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.text}>UI placeholder ✅</Text>
        <Text style={styles.sub}>Later backend se data aayega.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingTop: 6, flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: 16, fontWeight: "900", color: colors.ink },
  hSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: colors.muted },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  text: { fontSize: 16, fontWeight: "900", color: colors.ink },
  sub: { marginTop: 6, fontSize: 12, color: colors.muted, fontWeight: "700", textAlign: "center" },
});
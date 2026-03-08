import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { APP_LANGUAGES } from "../utils/languagePreference";
import { APP_LOGO, APP_NAME_UPPER } from "../theme/brand";
import { ruralPalette as P } from "../theme/ruralPalette";

export default function LanguageSelectScreen({
  initialLanguage = "hi",
  onContinue,
}: {
  initialLanguage?: string;
  onContinue: (language: string) => void;
}) {
  const [selected, setSelected] = useState(initialLanguage);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>{APP_NAME_UPPER}</Text>
        <Text style={styles.hindi}>अपनी भाषा चुनें</Text>
        <Text style={styles.subtitle}>Choose the language you want to use across voice and onboarding.</Text>
        <View style={styles.scrollHintRow}>
          <Ionicons name="arrow-down" size={16} color={P.goldDark} />
          <Text style={styles.scrollHintText}>Scroll down to explore languages</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroHalo} />
          <View style={styles.heroRing}>
            <View style={styles.heroCore}>
              <Image source={APP_LOGO} style={styles.heroLogo} resizeMode="contain" />
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.languageScroll}
          contentContainerStyle={styles.languageList}
          showsVerticalScrollIndicator={false}
        >
          {APP_LANGUAGES.map((language) => {
            const active = selected === language.code;
            return (
              <Pressable
                key={language.code}
                onPress={() => setSelected(language.code)}
                style={[styles.languageCard, active && styles.languageCardActive]}
              >
                <View>
                  <Text style={[styles.languageLabel, active && styles.languageLabelActive]}>{language.label}</Text>
                  <Text style={[styles.languageDescription, active && styles.languageDescriptionActive]}>
                    {language.description}
                  </Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioInner} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable style={styles.continueBtn} onPress={() => onContinue(selected)}>
          <Text style={styles.continueText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={P.surface} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
  },
  brand: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 3,
    color: P.ink,
    textAlign: "center",
  },
  hindi: {
    marginTop: 18,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: P.mutedDark,
    textAlign: "center",
  },
  scrollHintRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  scrollHintText: {
    fontSize: 12,
    fontWeight: "800",
    color: P.goldDark,
    letterSpacing: 0.4,
  },
  hero: {
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
    height: 132,
  },
  heroHalo: {
    position: "absolute",
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: P.goldTint,
  },
  heroRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: P.gold,
    backgroundColor: P.surface,
  },
  heroCore: {
    width: 102,
    height: 102,
    borderRadius: 51,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.gold,
  },
  heroLogo: {
    width: 72,
    height: 72,
  },
  languageScroll: {
    flex: 1,
    marginTop: 8,
  },
  languageList: {
    gap: 12,
    paddingTop: 10,
    paddingBottom: 18,
  },
  languageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
  },
  languageCardActive: {
    borderColor: P.goldDark,
    backgroundColor: P.surfaceSoft,
  },
  languageLabel: {
    fontSize: 22,
    fontWeight: "900",
    color: P.ink,
  },
  languageLabelActive: {
    color: P.goldDark,
  },
  languageDescription: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: P.mutedDark,
  },
  languageDescriptionActive: {
    color: P.ink,
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: P.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: P.goldDark,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: P.goldDark,
  },
  continueBtn: {
    height: 56,
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: P.goldDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueText: {
    fontSize: 16,
    fontWeight: "900",
    color: P.surface,
  },
});

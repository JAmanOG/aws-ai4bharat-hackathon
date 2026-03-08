import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { askDomains, ruralPalette as P } from "../theme/ruralPalette";
import { APP_LANGUAGES, readStoredLanguagePreference } from "../utils/languagePreference";

type Mode = "login" | "register";

export default function LoginScreen() {
  const { login, register, skipAuth, authNotice, clearAuthNotice } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("hi");
  const [loading, setLoading] = useState(false);
  const pinRef = useRef<TextInput>(null);

  const isValid = phone.length >= 10 && pin.length >= 4;
  const title = mode === "login" ? "Welcome back" : "Create your account";
  const subtitle = mode === "login"
    ? "Sign in to continue with voice-first rural assistance."
    : "Register once and keep your voice preferences across devices.";

  const visibleDomains = useMemo(() => askDomains.slice(0, 4), []);

  useEffect(() => {
    readStoredLanguagePreference()
      .then((stored) => {
        if (stored) setLanguage(stored);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!isValid) return;
    setLoading(true);

    try {
      clearAuthNotice();
      if (mode === "login") {
        await login(phone, pin);
      } else {
        await register({ phone, pin, name, language });
      }
    } catch (err: any) {
      Alert.alert(
        mode === "login" ? "Login failed" : "Registration failed",
        err.message || "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.brand}>RURAL ECOSYSTEM PLATFORM</Text>
            <Text style={styles.hindi}>आवाज़ से भरोसेमंद ग्रामीण मार्गदर्शन</Text>

            <View style={styles.logoWrap}>
              <View style={styles.logoHalo} />
              <View style={styles.logoRing}>
                <View style={styles.logoCore}>
                  <Ionicons name="mic" size={34} color={P.surface} />
                </View>
              </View>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <View style={styles.domainRow}>
              {visibleDomains.map((domain) => (
                <View key={domain.key} style={styles.domainChip}>
                  <View style={[styles.domainDot, { backgroundColor: domain.bubble }]}>
                    <Ionicons name={domain.icon} size={14} color={domain.iconColor} />
                  </View>
                  <Text style={styles.domainText}>{domain.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.formCard}>
            {authNotice ? (
              <View style={styles.noticeCard}>
                <View style={styles.noticeIcon}>
                  <Ionicons name="lock-closed" size={16} color={P.goldDark} />
                </View>
                <Text style={styles.noticeText}>{authNotice}</Text>
              </View>
            ) : null}

            <View style={styles.modeToggle}>
              <Pressable
                onPress={() => {
                  clearAuthNotice();
                  setMode("login");
                }}
                style={[styles.modeSegment, mode === "login" && styles.modeSegmentActive]}
              >
                <Text style={[styles.modeText, mode === "login" && styles.modeTextActive]}>Login</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  clearAuthNotice();
                  setMode("register");
                }}
                style={[styles.modeSegment, mode === "register" && styles.modeSegmentActive]}
              >
                <Text style={[styles.modeText, mode === "register" && styles.modeTextActive]}>Register</Text>
              </Pressable>
            </View>

            {mode === "register" ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={P.muted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor={P.muted}
                value={phone}
                onChangeText={(value) => setPhone(value.replace(/[^0-9]/g, ""))}
                keyboardType="phone-pad"
                maxLength={15}
                returnKeyType="next"
                onSubmitEditing={() => pinRef.current?.focus()}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PIN</Text>
              <TextInput
                ref={pinRef}
                style={styles.input}
                placeholder="4 to 6 digits"
                placeholderTextColor={P.muted}
                value={pin}
                onChangeText={(value) => setPin(value.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                onSubmitEditing={handleSubmit}
              />
            </View>

            {mode === "register" ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Preferred Language</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageRow}>
                  {APP_LANGUAGES.map((item) => (
                    <Pressable
                      key={item.code}
                      onPress={() => setLanguage(item.code)}
                      style={[styles.langChip, language === item.code && styles.langChipActive]}
                    >
                      <Text style={[styles.langChipText, language === item.code && styles.langChipTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={!isValid || loading}
              style={[styles.submitBtn, (!isValid || loading) && styles.submitBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={P.surface} />
              ) : (
                <>
                  <Text style={styles.submitText}>{mode === "login" ? "Continue" : "Create Account"}</Text>
                  <Ionicons name="arrow-forward" size={18} color={P.surface} />
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.switchModeBtn}
              onPress={() => {
                clearAuthNotice();
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              <Text style={styles.switchModeText}>
                {mode === "login" ? "Need a new account? Register" : "Already registered? Login"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.guestBtn}
              onPress={() => {
                clearAuthNotice();
                skipAuth();
              }}
            >
              <Ionicons name="play-circle" size={20} color={P.goldDark} />
              <Text style={styles.guestText}>Continue as Guest</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 34,
    backgroundColor: P.surfaceSoft,
    borderWidth: 1,
    borderColor: P.line,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
  },
  brand: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 3,
    color: P.ink,
    textAlign: "center",
  },
  hindi: {
    marginTop: 10,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  logoWrap: {
    marginTop: 22,
    width: 124,
    height: 124,
    alignItems: "center",
    justifyContent: "center",
  },
  logoHalo: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: P.goldTint,
  },
  logoRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: P.gold,
    backgroundColor: P.surface,
  },
  logoCore: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.gold,
  },
  title: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: P.mutedDark,
    textAlign: "center",
  },
  domainRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  domainChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.lineSoft,
  },
  domainDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  domainText: {
    fontSize: 11,
    fontWeight: "800",
    color: P.ink,
  },
  formCard: {
    marginTop: 18,
    borderRadius: 30,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    padding: 20,
    shadowColor: P.goldShadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  noticeCard: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.gold,
    backgroundColor: P.bgWarm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.goldTint,
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: P.ink,
  },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 4,
    backgroundColor: P.bgWarm,
    borderWidth: 1,
    borderColor: P.lineSoft,
  },
  modeSegment: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modeSegmentActive: {
    backgroundColor: P.gold,
  },
  modeText: {
    fontSize: 14,
    fontWeight: "800",
    color: P.mutedDark,
  },
  modeTextActive: {
    color: P.ink,
  },
  fieldGroup: {
    marginTop: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: P.goldDark,
  },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.line,
    backgroundColor: P.surfaceSoft,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "600",
    color: P.ink,
  },
  languageRow: {
    gap: 8,
    paddingRight: 6,
  },
  langChip: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.surfaceSoft,
    borderWidth: 1,
    borderColor: P.line,
  },
  langChipActive: {
    backgroundColor: P.gold,
    borderColor: P.gold,
  },
  langChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: P.mutedDark,
  },
  langChipTextActive: {
    color: P.ink,
  },
  submitBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: P.goldDark,
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "900",
    color: P.surface,
  },
  switchModeBtn: {
    marginTop: 18,
    alignItems: "center",
  },
  switchModeText: {
    fontSize: 14,
    fontWeight: "700",
    color: P.goldDark,
  },
  guestBtn: {
    marginTop: 18,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.line,
    backgroundColor: P.surfaceSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  guestText: {
    fontSize: 14,
    fontWeight: "800",
    color: P.ink,
  },
});

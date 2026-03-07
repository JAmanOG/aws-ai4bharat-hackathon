import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { healthApi, type SymptomCheckResult } from "../services/api";

const PALETTE = {
  screen: "#F7F0E2",
  paper: "#FEFCF7",
  card: "#FFFFFF",
  border: "#CCB267",
  gold: "#D8AF47",
  goldDeep: "#C79A2E",
  goldSoft: "#F2E2AE",
  ink: "#111111",
  muted: "#4A3E31",
  dim: "#786C59",
  low: "#D8AF47",
  medium: "#C68E2D",
  high: "#B54B31",
  critical: "#952A20",
  shadow: "rgba(126, 92, 31, 0.18)",
};

const QUICK_SYMPTOMS = [
  "fever",
  "cough",
  "headache",
  "chest pain",
  "breathing issue",
  "vomiting",
];

export default function SymptomCheckerScreen() {
  const nav = useNavigation<any>();

  const [symptoms, setSymptoms] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("female");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(true);
  const [result, setResult] = useState<SymptomCheckResult | null>(null);

  const riskTone = useMemo(() => {
    const risk = String(result?.risk_level || "").toLowerCase();
    if (risk === "critical") return PALETTE.critical;
    if (risk === "high") return PALETTE.high;
    if (risk === "medium" || risk === "moderate") return PALETTE.medium;
    return PALETTE.low;
  }, [result?.risk_level]);

  const handleToggleQuickSymptom = (label: string) => {
    const current = symptoms
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    const exists = current.some((entry) => entry.toLowerCase() === label.toLowerCase());
    const next = exists
      ? current.filter((entry) => entry.toLowerCase() !== label.toLowerCase())
      : [...current, label];

    setSymptoms(next.join(", "));
  };

  const handleMicPress = () => {
    setIsListening((current) => !current);
  };

  const handleCheckSymptoms = async () => {
    const symptomList = symptoms
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    const parsedAge = Number(age);
    if (symptomList.length === 0) {
      Alert.alert("Symptoms required", "Describe at least one symptom before checking.");
      return;
    }
    if (!parsedAge || parsedAge <= 0) {
      Alert.alert("Age required", "Enter a valid age so the AI triage can assess risk correctly.");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await healthApi.checkSymptoms({
        symptoms: symptomList,
        age: parsedAge,
        gender,
      });
      setResult(response);
      setIsListening(false);
    } catch (error: any) {
      Alert.alert("Unable to check symptoms", error?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}
          >
            <Ionicons name="chevron-back" size={28} color={PALETTE.ink} />
          </Pressable>
          <Text style={styles.title}>Symptom Checker</Text>
        </View>

        <Text style={styles.eyebrow}>AI HEALTH SCREENING</Text>

        <Pressable style={styles.micButton} onPress={handleMicPress}>
          <Ionicons name={isListening ? "mic" : "mic-outline"} size={54} color={PALETTE.card} />
        </Pressable>

        <Text style={styles.heroCopy}>
          {isListening
            ? "AI Assistant is listening. Describe your symptoms, age, and gender."
            : "Tap the mic again or type your symptoms, age, and gender below."}
        </Text>

        <View style={styles.visualRow}>
          <View style={styles.waveCard}>
            <GoldWave loading={loading} />
          </View>

          <View style={styles.summaryColumn}>
            <SummaryTile
              title="Possible Conditions"
              loading={loading}
              value={result ? `${(result.possible_conditions || []).length} found` : "Waiting"}
            />
            <SummaryTile
              title="Recommendations"
              loading={loading}
              value={result ? `${Math.max((result.home_remedies || []).length, 1)} steps` : "Waiting"}
            />
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: loading ? "58%" : result ? "100%" : "38%",
              },
            ]}
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Symptoms</Text>
          <TextInput
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="e.g. fever, cough, body pain"
            placeholderTextColor={PALETTE.dim}
            multiline
            style={styles.symptomInput}
          />

          <View style={styles.quickRow}>
            {QUICK_SYMPTOMS.map((label) => {
              const active = symptoms.toLowerCase().includes(label.toLowerCase());
              return (
                <Pressable
                  key={label}
                  onPress={() => handleToggleQuickSymptom(label)}
                  style={[styles.quickChip, active && styles.quickChipActive]}
                >
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.formRow}>
            <View style={styles.ageWrap}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="28"
                placeholderTextColor={PALETTE.dim}
                style={styles.ageInput}
              />
            </View>

            <View style={styles.genderWrap}>
              <Text style={styles.inputLabel}>Gender</Text>
              <View style={styles.genderRow}>
                {(["female", "male", "other"] as const).map((option) => {
                  const active = gender === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setGender(option)}
                      style={[styles.genderChip, active && styles.genderChipActive]}
                    >
                      <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        <Pressable style={styles.ctaButton} onPress={handleCheckSymptoms} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={PALETTE.ink} />
          ) : (
            <Text style={styles.ctaText}>CHECK SYMPTOMS</Text>
          )}
        </Pressable>

        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.resultTopRow}>
              <View style={[styles.riskBadge, { backgroundColor: riskTone }]}>
                <Text style={styles.riskBadgeText}>{String(result.risk_level || "low").toUpperCase()} RISK</Text>
              </View>
              <Text style={styles.urgencyText}>
                Urgency: <Text style={styles.urgencyValue}>{String(result.urgency || "routine")}</Text>
              </Text>
            </View>

            <ResultSection title="Possible Conditions">
              {(result.possible_conditions || []).map((condition, index) => (
                <BulletItem key={`${condition}-${index}`} icon="ellipse" text={condition} />
              ))}
            </ResultSection>

            <ResultSection title="Recommended Action">
              <Text style={styles.resultBody}>{result.recommended_action}</Text>
            </ResultSection>

            <ResultSection title="Home Remedies">
              {(result.home_remedies || []).length > 0 ? (
                (result.home_remedies || []).map((remedy, index) => (
                  <BulletItem key={`${remedy}-${index}`} icon="leaf" text={remedy} />
                ))
              ) : (
                <Text style={styles.resultBody}>No home remedies were returned for this risk level.</Text>
              )}
            </ResultSection>

            <ResultSection title="Warning Signs">
              {(result.warning_signs || []).map((warning, index) => (
                <BulletItem key={`${warning}-${index}`} icon="warning" text={warning} warning />
              ))}
            </ResultSection>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          Disclaimer: This result is useful for symptom screening only. It is not a confirmed medical diagnosis. If symptoms worsen, contact a certified healthcare professional immediately.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function GoldWave({ loading }: { loading: boolean }) {
  return (
    <Svg width="100%" height={150} viewBox="0 0 420 150">
      <Defs>
        <LinearGradient id="wave" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#D0A43A" />
          <Stop offset="50%" stopColor="#E4C66B" />
          <Stop offset="100%" stopColor="#C89A34" />
        </LinearGradient>
        <LinearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#EAD89A" stopOpacity="0.7" />
          <Stop offset="100%" stopColor="#EAD89A" stopOpacity="0.12" />
        </LinearGradient>
      </Defs>

      <Circle cx="80" cy="74" r="22" fill="url(#glow)" />
      <Circle cx="160" cy="80" r="34" fill="url(#glow)" />
      <Circle cx="238" cy="62" r="26" fill="url(#glow)" />
      <Circle cx="322" cy="84" r="30" fill="url(#glow)" />

      <Path
        d="M 12 84 C 36 84, 40 54, 68 72 C 90 86, 96 118, 120 102 C 136 92, 142 70, 158 78 C 174 86, 178 120, 196 118 C 220 116, 226 22, 248 22 C 266 22, 274 110, 296 110 C 314 110, 326 72, 344 72 C 360 72, 366 96, 386 96 C 400 96, 408 84, 420 84"
        stroke="url(#wave)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Rect
        x="0"
        y="136"
        width="420"
        height="10"
        rx="5"
        fill="#EBDDB5"
      />
      <Rect
        x="0"
        y="136"
        width={loading ? 244 : 160}
        height="10"
        rx="5"
        fill="url(#wave)"
      />
    </Svg>
  );
}

function SummaryTile({
  title,
  loading,
  value,
}: {
  title: string;
  loading: boolean;
  value: string;
}) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <View style={styles.summaryBody}>
        {loading ? (
          <ActivityIndicator size="small" color={PALETTE.goldDeep} />
        ) : (
          <Text style={styles.summaryValue}>{value}</Text>
        )}
      </View>
    </View>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.resultSection}>
      <Text style={styles.resultHeading}>{title}</Text>
      <View style={styles.resultSectionBody}>{children}</View>
    </View>
  );
}

function BulletItem({
  icon,
  text,
  warning = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  warning?: boolean;
}) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons name={icon} size={16} color={warning ? PALETTE.medium : PALETTE.goldDeep} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.screen,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  eyebrow: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
    color: PALETTE.ink,
    letterSpacing: 0.6,
  },
  micButton: {
    width: 138,
    height: 138,
    borderRadius: 69,
    alignSelf: "center",
    marginTop: 28,
    backgroundColor: PALETTE.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroCopy: {
    marginTop: 26,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    color: PALETTE.muted,
    paddingHorizontal: 18,
  },
  visualRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 22,
    alignItems: "flex-end",
  },
  waveCard: {
    flex: 1,
    minHeight: 160,
    justifyContent: "flex-end",
  },
  summaryColumn: {
    width: 112,
    gap: 10,
  },
  summaryTile: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: PALETTE.border,
    padding: 10,
    minHeight: 98,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: PALETTE.ink,
    lineHeight: 16,
  },
  summaryBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    color: PALETTE.dim,
    fontWeight: "700",
  },
  progressTrack: {
    marginTop: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#EADDB9",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: PALETTE.gold,
  },
  formCard: {
    marginTop: 18,
    backgroundColor: PALETTE.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E4D7B6",
    padding: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: PALETTE.ink,
    marginBottom: 8,
  },
  symptomInput: {
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E0D2AD",
    backgroundColor: PALETTE.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    color: PALETTE.ink,
    textAlignVertical: "top",
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1E4BC",
  },
  quickChipActive: {
    backgroundColor: PALETTE.gold,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: PALETTE.muted,
  },
  quickChipTextActive: {
    color: PALETTE.ink,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  ageWrap: {
    width: 86,
  },
  ageInput: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0D2AD",
    backgroundColor: PALETTE.card,
    paddingHorizontal: 12,
    fontSize: 15,
    color: PALETTE.ink,
  },
  genderWrap: {
    flex: 1,
  },
  genderRow: {
    flexDirection: "row",
    gap: 8,
  },
  genderChip: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0D2AD",
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
  },
  genderChipActive: {
    backgroundColor: PALETTE.goldSoft,
    borderColor: PALETTE.gold,
  },
  genderChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: PALETTE.dim,
  },
  genderChipTextActive: {
    color: PALETTE.ink,
  },
  ctaButton: {
    marginTop: 18,
    minHeight: 64,
    borderRadius: 32,
    backgroundColor: PALETTE.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "900",
    color: PALETTE.ink,
    letterSpacing: 0.4,
  },
  resultCard: {
    marginTop: 20,
    backgroundColor: PALETTE.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: PALETTE.border,
    padding: 18,
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  riskBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: PALETTE.card,
  },
  urgencyText: {
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  urgencyValue: {
    fontWeight: "500",
  },
  resultSection: {
    marginTop: 14,
  },
  resultHeading: {
    fontSize: 17,
    fontWeight: "900",
    color: PALETTE.ink,
    marginBottom: 6,
  },
  resultSectionBody: {
    gap: 6,
  },
  resultBody: {
    fontSize: 15,
    lineHeight: 22,
    color: PALETTE.muted,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: PALETTE.muted,
  },
  disclaimer: {
    marginTop: 20,
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.muted,
  },
});

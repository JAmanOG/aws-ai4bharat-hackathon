import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useHealthPortals, useHealthProviders } from "../hooks/useData";
import {
  healthApi,
  type HealthImagingAnalysisResponse,
  type HealthImagingType,
  type HealthPortal,
  type HealthProvider,
} from "../services/api";

const PALETTE = {
  screen: "#F6EFDF",
  screenGlow: "#FBF7EE",
  card: "#FFFFFF",
  tile: "#F4ECD8",
  line: "#D8C8A5",
  ink: "#111111",
  muted: "#3F3527",
  dim: "#776A57",
  gold: "#D8AF47",
  goldDeep: "#C79A2E",
  goldSoft: "#F2E0A8",
  shadow: "rgba(120, 86, 26, 0.16)",
  outline: "#5E4B31",
  badge: "#F4E6B9",
  success: "#5E8B43",
  danger: "#B53B30",
};

const REPORT_TYPES: Array<{ label: string; value: HealthImagingType }> = [
  { label: "Lab report", value: "pathology" },
  { label: "X-ray", value: "xray" },
  { label: "MRI", value: "mri" },
  { label: "CT", value: "ct_scan" },
  { label: "Ultrasound", value: "ultrasound" },
];

const FALLBACK_SCHEMES: HealthPortal[] = [
  {
    id: "fallback-pmjay",
    name: "Ayushman Bharat (PM-JAY)",
    description: "Health cover for secondary and tertiary hospitalization support.",
    category: "insurance",
    url: "https://pmjay.gov.in",
  },
  {
    id: "fallback-nhm",
    name: "National Health Mission (NHM)",
    description: "Maternal, child, immunization, and PHC-linked services across rural India.",
    category: "maternal",
    url: "https://nhm.gov.in",
  },
  {
    id: "fallback-cghs",
    name: "Central Government Health Scheme (CGHS)",
    description: "Government-backed care network for eligible central government beneficiaries.",
    category: "insurance",
    url: "https://www.cghs.gov.in",
  },
  {
    id: "fallback-esanjeevani",
    name: "eSanjeevani",
    description: "National telemedicine service for online consultations and follow-up guidance.",
    category: "telemedicine",
    url: "https://esanjeevani.in",
  },
];

const FALLBACK_PROVIDERS: HealthProvider[] = [
  { id: "apollo", name: "Apollo Hospitals", type: "hospital", city: "Pan-India", address: "Hospital network", website: "https://www.apollohospitals.com" },
  { id: "pharmeasy", name: "PharmEasy", type: "pharmacy", city: "Pan-India", address: "Online provider", website: "https://pharmeasy.in" },
  { id: "practo", name: "Practo", type: "telemedicine", city: "Pan-India", address: "Online provider", website: "https://www.practo.com" },
  { id: "tata1mg", name: "Tata 1mg", type: "pharmacy", city: "Pan-India", address: "Online provider", website: "https://www.1mg.com" },
  { id: "mfine", name: "mFine", type: "telemedicine", city: "Pan-India", address: "Online provider", website: "https://www.mfine.co" },
  { id: "fortis", name: "Fortis Hospital", type: "hospital", city: "Pan-India", address: "Hospital network", website: "https://www.fortishealthcare.com" },
];

type PickerAsset = DocumentPicker.DocumentPickerAsset;
type BusyState = "idle" | "uploading" | "analyzing";
type ActiveSheet = "schemes" | "providers" | "insights" | null;

export default function HealthDashboardScreen() {
  const nav = useNavigation<any>();
  const portals = useHealthPortals();
  const providers = useHealthProviders({ limit: 24 });

  const [reportType, setReportType] = useState<HealthImagingType>("pathology");
  const [pickedFile, setPickedFile] = useState<PickerAsset | null>(null);
  const [uploadedReport, setUploadedReport] = useState<{
    documentId: string;
    imagingType: HealthImagingType;
    fileName: string;
  } | null>(null);
  const [analysis, setAnalysis] = useState<HealthImagingAnalysisResponse | null>(null);
  const [busyState, setBusyState] = useState<BusyState>("idle");
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  const schemeList = useMemo(() => {
    const live = Array.isArray(portals.data) ? portals.data : [];
    const byName = new Map(live.map((entry) => [entry.name.toLowerCase(), entry]));
    const ordered = [
      "Ayushman Bharat (PM-JAY)",
      "National Health Mission (NHM)",
      "Central Government Health Scheme (CGHS)",
      "eSanjeevani",
    ]
      .map((name) => byName.get(name.toLowerCase()))
      .filter(Boolean) as HealthPortal[];

    const remaining = live
      .filter((entry) => !ordered.some((item) => item.id === entry.id))
      .sort((left, right) => left.name.localeCompare(right.name));

    return [...ordered, ...remaining].slice(0, 8);
  }, [portals.data]);

  const visibleSchemes = schemeList.length > 0 ? schemeList : FALLBACK_SCHEMES;
  const schemePreview = visibleSchemes.slice(0, 4);

  const thirdPartyProviders = useMemo(() => {
    const live = Array.isArray((providers.data as any)?.providers)
      ? ((providers.data as any)?.providers as HealthProvider[])
      : [];
    const byName = new Map(live.map((entry) => [entry.name.toLowerCase(), entry]));
    const orderedNames = [
      "Apollo Hospitals",
      "PharmEasy",
      "Practo",
      "Tata 1mg",
      "mFine",
      "Fortis Hospital",
    ];

    const ordered = orderedNames
      .map((name) => byName.get(name.toLowerCase()))
      .filter(Boolean) as HealthProvider[];

    const remaining = live
      .filter((entry) => entry.website && entry.type !== "govt-hospital" && !ordered.some((item) => item.id === entry.id))
      .slice(0, 6 - ordered.length);

    const result = [...ordered, ...remaining];
    return result.length > 0 ? result.slice(0, 6) : FALLBACK_PROVIDERS;
  }, [providers.data]);

  const telemedicinePortal = useMemo(
    () =>
      visibleSchemes.find((entry) => entry.name.toLowerCase().includes("esanjeevani"))
      ?? FALLBACK_SCHEMES.find((entry) => entry.name.toLowerCase().includes("esanjeevani"))
      ?? FALLBACK_SCHEMES[0],
    [visibleSchemes],
  );

  const reportStatus = useMemo(() => {
    if (analysis) {
      return "AI insights ready to review";
    }
    if (uploadedReport) {
      return `${formatReportType(uploadedReport.imagingType)} uploaded and ready for analysis`;
    }
    if (pickedFile) {
      return `${pickedFile.name} selected`;
    }
    return "Upload a report or scan to get AI-assisted observations.";
  }, [analysis, pickedFile, uploadedReport]);

  const pickMedicalReport = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ["application/pdf", "image/jpeg", "image/png"],
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    const mimeType = normalizeMimeType(asset);
    if (!mimeType) {
      Alert.alert("Unsupported file", "Please choose a PDF, JPG, or PNG medical report.");
      return null;
    }

    setPickedFile(asset);
    setUploadedReport(null);
    setAnalysis(null);
    if (mimeType === "application/pdf") {
      setReportType("pathology");
    }
    return asset;
  }, []);

  const uploadMedicalReport = useCallback(
    async (sourceAsset?: PickerAsset | null) => {
      if (
        !sourceAsset
        && uploadedReport
        && uploadedReport.imagingType === reportType
        && (!pickedFile || uploadedReport.fileName === (pickedFile.name || "medical-report"))
      ) {
        return uploadedReport;
      }

      const asset = sourceAsset ?? pickedFile ?? await pickMedicalReport();
      if (!asset) {
        return null;
      }

      const mimeType = normalizeMimeType(asset);
      if (!mimeType) {
        Alert.alert("Unsupported file", "Please choose a PDF, JPG, or PNG medical report.");
        return null;
      }

      setBusyState("uploading");
      try {
        const upload = await healthApi.initiateUpload({
          fileName: asset.name || `medical-report-${Date.now()}`,
          fileType: mimeType,
          imagingType: reportType,
          metadata: {
            description: `Health dashboard upload for ${formatReportType(reportType)}`,
            originalName: asset.name || "medical-report",
          },
        });

        const localFile = await fetch(asset.uri);
        const fileBuffer = await localFile.arrayBuffer();
        const uploadResponse = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: fileBuffer,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        const nextUploadedReport = {
          documentId: upload.documentId,
          imagingType: reportType,
          fileName: asset.name || "medical-report",
        };

        setPickedFile(asset);
        setUploadedReport(nextUploadedReport);
        setBusyState("idle");
        return nextUploadedReport;
      } catch (error: any) {
        setBusyState("idle");
        throw error;
      }
    },
    [pickMedicalReport, pickedFile, reportType, uploadedReport],
  );

  const handleUploadReport = useCallback(async () => {
    try {
      const uploaded = await uploadMedicalReport();
      if (!uploaded) {
        return;
      }
      Alert.alert("Report uploaded", `${uploaded.fileName} is ready for AI insights.`);
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message ?? "Unable to upload the selected report.");
    }
  }, [uploadMedicalReport]);

  const handleAnalyzeReport = useCallback(async () => {
    try {
      const uploaded = await uploadMedicalReport();
      if (!uploaded) {
        return;
      }

      setBusyState("analyzing");
      const result = await healthApi.analyzeImage(uploaded.documentId, uploaded.imagingType);
      setAnalysis(result);
      setActiveSheet("insights");
    } catch (error: any) {
      Alert.alert("Analysis failed", error?.message ?? "Unable to generate medical report insights right now.");
    } finally {
      setBusyState("idle");
    }
  }, [uploadMedicalReport]);

  const openExternal = useCallback(async (url?: string) => {
    if (!url) {
      Alert.alert("Link unavailable", "This service does not have a public link right now.");
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot open link", "The provider site could not be opened on this device.");
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}
          >
            <Ionicons name="chevron-back" size={28} color={PALETTE.card} />
          </Pressable>
          <Text style={styles.title}>AI Health Screening</Text>
        </View>

        <View style={styles.featureCard}>
          <IconTile icon="medkit-outline" />
          <View style={styles.featureBody}>
            <Text style={styles.featureTitle}>Symptom &amp; Risk Profiling</Text>
            <Text style={styles.featureSub}>Symptom check &amp; risk assessment</Text>
            <Pressable style={styles.primaryButton} onPress={() => nav.navigate("SymptomChecker")}>
              <Text style={styles.primaryButtonText}>Start Screening</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.featureCard}>
          <IconTile icon="document-text-outline" />
          <View style={styles.featureBody}>
            <Text style={styles.featureTitle}>Medical Report Insights</Text>
            <Text style={styles.featureSub}>Analyze MRI, X-ray, CT, ultrasound, or lab reports</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reportTypeRow}
            >
              {REPORT_TYPES.map((option) => {
                const active = reportType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setReportType(option.value)}
                    style={[styles.reportTypePill, active && styles.reportTypePillActive]}
                  >
                    <Text style={[styles.reportTypeText, active && styles.reportTypeTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.secondaryButtonRow}>
              <Pressable
                style={styles.outlineButton}
                onPress={handleUploadReport}
                disabled={busyState !== "idle"}
              >
                {busyState === "uploading" ? (
                  <ActivityIndicator size="small" color={PALETTE.ink} />
                ) : (
                  <Text style={styles.outlineButtonText}>Upload Report</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.outlineButton}
                onPress={handleAnalyzeReport}
                disabled={busyState !== "idle"}
              >
                {busyState === "analyzing" ? (
                  <ActivityIndicator size="small" color={PALETTE.ink} />
                ) : (
                  <Text style={styles.outlineButtonText}>Get Insights</Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.reportStatus}>{reportStatus}</Text>

            {analysis ? (
              <Pressable style={styles.insightPreview} onPress={() => setActiveSheet("insights")}>
                <Text style={styles.insightPreviewTitle}>Latest insight</Text>
                <Text style={styles.insightPreviewText} numberOfLines={3}>
                  {analysis.analysis.general_info || "Your AI-assisted report summary is ready to review."}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.schemeCard}>
          <View style={styles.schemeHeaderRow}>
            <View style={styles.schemeSeal}>
              <Text style={styles.schemeSealTop}>AYUSHMAN</Text>
              <Text style={styles.schemeSealBottom}>CARE</Text>
            </View>
            <View style={styles.schemeBody}>
              <Text style={styles.featureTitle}>Government Health Schemes</Text>
              {schemePreview.map((entry) => (
                <Text key={entry.id} style={styles.schemeLine}>
                  {entry.name}
                </Text>
              ))}
              <Pressable style={styles.primaryButton} onPress={() => setActiveSheet("schemes")}>
                <Text style={styles.primaryButtonText}>View All Schemes</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Consult Doctors</Text>

        <View style={styles.consultRow}>
          <View style={styles.consultCard}>
            <ProviderBadge label="eSanjeevani" mono />
            <Text style={styles.consultTitle}>Government Telemedicine{"\n"}(eSanjeevani)</Text>
            <Text style={styles.consultCopy}>
              Quick access to doctors &amp; specialists via smartphone.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => openExternal(telemedicinePortal.url)}>
              <Text style={styles.primaryButtonText}>Visit Site</Text>
            </Pressable>
          </View>

          <View style={styles.consultCard}>
            <Text style={styles.consultTitle}>Third-Party{"\n"}Consultations</Text>
            <View style={styles.providerGrid}>
              {thirdPartyProviders.slice(0, 6).map((provider) => (
                <ProviderBadge key={provider.id} label={provider.name} />
              ))}
            </View>
            <Pressable style={styles.primaryButton} onPress={() => setActiveSheet("providers")}>
              <Text style={styles.primaryButtonText}>Explore Providers</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <DashboardSheet
        visible={activeSheet === "schemes"}
        title="Government Health Schemes"
        onClose={() => setActiveSheet(null)}
      >
        {portals.loading ? (
          <ActivityIndicator color={PALETTE.goldDeep} style={styles.sheetLoader} />
        ) : (
          visibleSchemes.map((scheme) => (
            <Pressable key={scheme.id} style={styles.sheetCard} onPress={() => openExternal(scheme.url)}>
              <Text style={styles.sheetCardTitle}>{scheme.name}</Text>
              <Text style={styles.sheetCardCopy}>{scheme.description}</Text>
            </Pressable>
          ))
        )}
      </DashboardSheet>

      <DashboardSheet
        visible={activeSheet === "providers"}
        title="Consultation Providers"
        onClose={() => setActiveSheet(null)}
      >
        {providers.loading ? (
          <ActivityIndicator color={PALETTE.goldDeep} style={styles.sheetLoader} />
        ) : (
          thirdPartyProviders.map((provider) => (
            <Pressable key={provider.id} style={styles.sheetCard} onPress={() => openExternal(provider.website)}>
              <Text style={styles.sheetCardTitle}>{provider.name}</Text>
              <Text style={styles.sheetCardMeta}>
                {[provider.type, provider.city].filter(Boolean).join(" • ")}
              </Text>
              <Text style={styles.sheetCardCopy}>{provider.address}</Text>
            </Pressable>
          ))
        )}
      </DashboardSheet>

      <DashboardSheet
        visible={activeSheet === "insights"}
        title="Medical Report Insights"
        onClose={() => setActiveSheet(null)}
      >
        {analysis ? (
          <View style={styles.analysisCard}>
            <Text style={styles.analysisHeading}>Overview</Text>
            <Text style={styles.analysisCopy}>
              {analysis.analysis.general_info || "No general summary was returned for this upload."}
            </Text>

            <Text style={styles.analysisHeading}>Common findings</Text>
            {(analysis.analysis.common_findings || []).length > 0 ? (
              (analysis.analysis.common_findings || []).map((finding, index) => (
                <View key={`${finding}-${index}`} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{finding}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.analysisCopy}>No highlighted findings were returned.</Text>
            )}

            <Text style={styles.analysisHeading}>What to discuss next</Text>
            <Text style={styles.analysisCopy}>
              {analysis.analysis.next_steps || analysis.recommendation || "Share this report summary with a doctor for interpretation."}
            </Text>

            {analysis.analysis.important_note ? (
              <>
                <Text style={styles.analysisHeading}>Important note</Text>
                <Text style={styles.analysisCopy}>{analysis.analysis.important_note}</Text>
              </>
            ) : null}

            {analysis.disclaimer ? (
              <Text style={styles.analysisDisclaimer}>{analysis.disclaimer}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.sheetEmpty}>Upload and analyze a report to see AI-assisted insights.</Text>
        )}
      </DashboardSheet>
    </SafeAreaView>
  );
}

function DashboardSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable style={styles.sheetClose} onPress={onClose}>
              <Ionicons name="close" size={22} color={PALETTE.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function IconTile({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.iconTile}>
      <Ionicons name={icon} size={42} color={PALETTE.ink} />
    </View>
  );
}

function ProviderBadge({ label, mono = false }: { label: string; mono?: boolean }) {
  return (
    <View style={[styles.providerBadge, mono && styles.providerBadgeMono]}>
      <Text style={[styles.providerBadgeText, mono && styles.providerBadgeTextMono]}>
        {badgeLabel(label)}
      </Text>
    </View>
  );
}

function normalizeMimeType(asset: PickerAsset): "application/pdf" | "image/jpeg" | "image/png" | null {
  const raw = String(asset.mimeType || "").toLowerCase();
  if (raw === "application/pdf") return "application/pdf";
  if (raw === "image/png") return "image/png";
  if (raw === "image/jpeg" || raw === "image/jpg") return "image/jpeg";

  const lowerName = String(asset.name || "").toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

function formatReportType(value: HealthImagingType) {
  const match = REPORT_TYPES.find((entry) => entry.value === value);
  return match?.label || value.replace(/_/g, " ");
}

function badgeLabel(label: string) {
  const clean = label
    .replace("Hospitals", "")
    .replace("Hospital", "")
    .replace(/\(.*?\)/g, "")
    .trim();

  if (clean.length <= 12) {
    return clean;
  }
  return clean.split(/\s+/).slice(0, 2).join(" ");
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.screen,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 34,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PALETTE.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  featureCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    gap: 16,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  iconTile: {
    width: 86,
    height: 86,
    borderRadius: 20,
    backgroundColor: PALETTE.tile,
    alignItems: "center",
    justifyContent: "center",
  },
  featureBody: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: PALETTE.ink,
    marginBottom: 4,
  },
  featureSub: {
    fontSize: 13,
    lineHeight: 18,
    color: PALETTE.muted,
    marginBottom: 12,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: PALETTE.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  reportTypeRow: {
    gap: 8,
    paddingBottom: 6,
  },
  reportTypePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: PALETTE.screenGlow,
  },
  reportTypePillActive: {
    backgroundColor: PALETTE.badge,
    borderColor: PALETTE.goldDeep,
  },
  reportTypeText: {
    fontSize: 12,
    fontWeight: "800",
    color: PALETTE.dim,
  },
  reportTypeTextActive: {
    color: PALETTE.ink,
  },
  secondaryButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  outlineButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: PALETTE.outline,
    backgroundColor: PALETTE.screenGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  reportStatus: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.dim,
  },
  insightPreview: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: PALETTE.screenGlow,
    borderWidth: 1,
    borderColor: PALETTE.line,
  },
  insightPreviewTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: PALETTE.goldDeep,
    marginBottom: 4,
  },
  insightPreviewText: {
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.muted,
  },
  schemeCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 16,
    marginBottom: 22,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  schemeHeaderRow: {
    flexDirection: "row",
    gap: 16,
  },
  schemeSeal: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderColor: PALETTE.line,
    backgroundColor: "#FFFDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  schemeSealTop: {
    fontSize: 10,
    fontWeight: "900",
    color: PALETTE.dim,
    letterSpacing: 0.6,
  },
  schemeSealBottom: {
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
    marginTop: 2,
  },
  schemeBody: {
    flex: 1,
  },
  schemeLine: {
    fontSize: 13,
    lineHeight: 19,
    color: PALETTE.muted,
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 26,
    fontWeight: "900",
    color: PALETTE.ink,
    marginBottom: 14,
  },
  consultRow: {
    flexDirection: "row",
    gap: 12,
  },
  consultCard: {
    flex: 1,
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 16,
    minHeight: 250,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  consultTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    color: PALETTE.ink,
    marginTop: 12,
    marginBottom: 10,
  },
  consultCopy: {
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.muted,
    marginBottom: 16,
  },
  providerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    marginBottom: 18,
  },
  providerBadge: {
    minWidth: 58,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  providerBadgeMono: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: PALETTE.line,
  },
  providerBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: PALETTE.ink,
    textAlign: "center",
  },
  providerBadgeTextMono: {
    fontSize: 12,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 17, 17, 0.28)",
    justifyContent: "flex-end",
  },
  sheetWrap: {
    backgroundColor: PALETTE.screenGlow,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    maxHeight: "82%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: PALETTE.line,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  sheetClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.card,
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingBottom: 30,
    gap: 12,
  },
  sheetLoader: {
    marginTop: 24,
  },
  sheetCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 14,
  },
  sheetCardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: PALETTE.ink,
    marginBottom: 4,
  },
  sheetCardMeta: {
    fontSize: 11,
    fontWeight: "800",
    color: PALETTE.goldDeep,
    marginBottom: 4,
  },
  sheetCardCopy: {
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.muted,
  },
  analysisCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 16,
  },
  analysisHeading: {
    fontSize: 14,
    fontWeight: "900",
    color: PALETTE.ink,
    marginBottom: 6,
    marginTop: 12,
  },
  analysisCopy: {
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.muted,
  },
  analysisDisclaimer: {
    marginTop: 16,
    fontSize: 11,
    lineHeight: 16,
    color: PALETTE.dim,
  },
  sheetEmpty: {
    fontSize: 13,
    lineHeight: 19,
    color: PALETTE.muted,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PALETTE.goldDeep,
    marginTop: 5,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.muted,
  },
});

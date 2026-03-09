import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useHealthPortals, useHealthProviders } from "../hooks/useData";
import { useScreenContext } from "../context/ScreenContext";
import { useDemoScreenActions } from "../demo/DemoActions";
import {
  PALETTE,
  styles,
} from "../features/health/healthDashboardTheme";
import {
  buildHealthProviderList,
  buildHealthSchemeList,
  findTelemedicinePortal,
} from "../features/health/dashboardData";
import {
  DashboardSheet,
  IconTile,
  ProviderBadge,
} from "../features/health/components/HealthDashboardPrimitives";
import {
  REPORT_TYPES,
  formatReportType,
  normalizeMimeType,
} from "../features/health/healthDashboardUtils";
import {
  healthApi,
  type HealthImagingAnalysisResponse,
  type HealthImagingType,
  type HealthPortal,
  type HealthProvider,
} from "../services/api";

type PickerAsset = DocumentPicker.DocumentPickerAsset;
type BusyState = "idle" | "uploading" | "analyzing";
type ActiveSheet = "schemes" | "providers" | "insights" | null;

export default function HealthDashboardScreen() {
  const nav = useNavigation<any>();
  const screen = useScreenContext();
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

  const demoActions = useMemo(
    () => ({
      openSchemes: () => setActiveSheet("schemes"),
      openProviders: () => setActiveSheet("providers"),
      openInsights: () => setActiveSheet("insights"),
      closeSheet: () => setActiveSheet(null),
    }),
    [],
  );

  useDemoScreenActions("HealthDashboard", demoActions);

  const livePortals = useMemo(
    () => (Array.isArray(portals.data) ? (portals.data as HealthPortal[]) : []),
    [portals.data],
  );
  const liveProviderRows = useMemo(
    () =>
      Array.isArray((providers.data as any)?.providers)
        ? (((providers.data as any)?.providers as HealthProvider[]))
        : [],
    [providers.data],
  );

  const visibleSchemes = useMemo(
    () => buildHealthSchemeList(livePortals).slice(0, 8),
    [livePortals],
  );
  const schemePreview = visibleSchemes.slice(0, 4);
  const thirdPartyProviders = useMemo(
    () => buildHealthProviderList(liveProviderRows).slice(0, 6),
    [liveProviderRows],
  );
  const telemedicinePortal = useMemo(
    () => findTelemedicinePortal(livePortals),
    [livePortals],
  );
  const availableActions = useMemo(
    () =>
      [
        "Start Screening",
        "Upload Report",
        "Get Insights",
        visibleSchemes.length > 0 ? "View All Schemes" : null,
        telemedicinePortal?.url ? "Visit Telemedicine Site" : null,
        thirdPartyProviders.length > 0 ? "Explore Providers" : null,
      ]
        .filter(Boolean)
        .join(", "),
    [telemedicinePortal?.url, thirdPartyProviders.length, visibleSchemes.length],
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

  useEffect(() => {
    screen.update({
      screen: "HealthDashboard",
      tab: activeSheet || "overview",
      meta: {
        availableActions,
        availableReportTypes: REPORT_TYPES.map((entry) => entry.label).join(", "),
        selectedReportType: formatReportType(reportType),
        selectedReportName: pickedFile?.name || "None",
        uploadedReportName: uploadedReport?.fileName || "None",
        reportStatus,
        insightsReady: analysis ? "Yes" : "No",
        insightSummary: analysis?.analysis.general_info?.slice(0, 180) || "None",
        visibleSchemeNames: schemePreview.map((entry) => entry.name).join(", "),
        visibleProviderNames: thirdPartyProviders.slice(0, 6).map((entry) => entry.name).join(", "),
        activeSheet: activeSheet || "none",
      },
    });
  }, [
    activeSheet,
    analysis,
    availableActions,
    pickedFile?.name,
    portals.loading,
    providers.loading,
    reportStatus,
    reportType,
    schemePreview,
    screen.update,
    thirdPartyProviders,
    uploadedReport?.fileName,
  ]);

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
              {schemePreview.length > 0 ? (
                schemePreview.map((entry) => (
                  <Text key={entry.id} style={styles.schemeLine}>
                    {entry.name}
                  </Text>
                ))
              ) : portals.loading ? (
                <Text style={styles.schemeHint}>Loading government scheme directory…</Text>
              ) : (
                <Text style={styles.schemeHint}>No government scheme records are available right now.</Text>
              )}
              <Pressable
                style={[styles.primaryButton, schemePreview.length === 0 && !portals.loading && styles.primaryButtonDisabled]}
                onPress={() => setActiveSheet("schemes")}
                disabled={schemePreview.length === 0 && !portals.loading}
              >
                <Text style={styles.primaryButtonText}>View All Schemes</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Consult Doctors</Text>

        <View style={styles.consultRow}>
          <View style={styles.consultCard}>
            {telemedicinePortal ? (
              <>
                <ProviderBadge label={telemedicinePortal.name} mono />
                <Text style={styles.consultTitle}>Government Telemedicine{"\n"}({telemedicinePortal.name})</Text>
                <Text style={styles.consultCopy}>
                  {telemedicinePortal.description || "Quick access to doctors and specialists via smartphone."}
                </Text>
                <Pressable style={styles.primaryButton} onPress={() => openExternal(telemedicinePortal.url)}>
                  <Text style={styles.primaryButtonText}>Visit Site</Text>
                </Pressable>
              </>
            ) : portals.loading ? (
              <>
                <Text style={styles.consultTitle}>Government Telemedicine</Text>
                <Text style={styles.consultUnavailable}>Loading telemedicine directory…</Text>
              </>
            ) : (
              <>
                <Text style={styles.consultTitle}>Government Telemedicine</Text>
                <Text style={styles.consultUnavailable}>No government telemedicine portal is available right now.</Text>
              </>
            )}
          </View>

          <View style={styles.consultCard}>
            <Text style={styles.consultTitle}>Third-Party{"\n"}Consultations</Text>
            {thirdPartyProviders.length > 0 ? (
              <View style={styles.providerGrid}>
                {thirdPartyProviders.slice(0, 6).map((provider) => (
                  <ProviderBadge key={provider.id} label={provider.name} />
                ))}
              </View>
            ) : providers.loading ? (
              <Text style={styles.consultUnavailable}>Loading provider directory…</Text>
            ) : (
              <Text style={styles.consultUnavailable}>No provider listings are available right now.</Text>
            )}
            <Pressable
              style={[styles.primaryButton, thirdPartyProviders.length === 0 && !providers.loading && styles.primaryButtonDisabled]}
              onPress={() => setActiveSheet("providers")}
              disabled={thirdPartyProviders.length === 0 && !providers.loading}
            >
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
        ) : visibleSchemes.length === 0 ? (
          <Text style={styles.sheetEmpty}>No government health scheme records are available right now.</Text>
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
        ) : thirdPartyProviders.length === 0 ? (
          <Text style={styles.sheetEmpty}>No consultation provider records are available right now.</Text>
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

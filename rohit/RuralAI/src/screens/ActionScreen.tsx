import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  ActivityIndicator, Image
} from "react-native";
import { useAlert } from "../components/ui/AlertProvider";
import { Button } from "../components/ui/Button";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { healthApi } from "../api/health";
import { governmentApi } from "../api/community";
import * as ImagePicker from 'expo-image-picker';

export default function ActionScreen() {
  const { showAlert } = useAlert();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const moduleTitle = route?.params?.moduleTitle;
  const actionTitle = route?.params?.actionTitle;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => { console.log("[NAV] Navigating back from ActionScreen"); nav.goBack(); }}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>{actionTitle || ""}</Text>
          <Text style={styles.hSub}>{moduleTitle || ""}</Text>
        </View>
      </View>

      {actionTitle === "Symptom Checker" && <SymptomCheckerView showAlert={showAlert} />}
      {actionTitle === "Medical Scans" && <MedicalScansView showAlert={showAlert} />}
      {actionTitle === "Report Issue" && <ReportIssueView showAlert={showAlert} />}
      {(actionTitle === "Wellness & Nutrition" || actionTitle === "Health Records") && <HealthArticlesView showAlert={showAlert} />}
      {(actionTitle === "Govt Benefits" || actionTitle === "Micro-credit & Loans") && <GovtPortalsView />}
      {actionTitle && ![
        "Symptom Checker", "Medical Scans", "Report Issue", "Wellness & Nutrition",
        "Health Records", "Govt Benefits", "Micro-credit & Loans"
      ].includes(actionTitle) && <ComingSoonView actionTitle={actionTitle} />}
    </SafeAreaView>
  );
}

/* ═══ Symptom Checker ═══ */
function SymptomCheckerView({ showAlert }: { showAlert: any }) {
  const [symptoms, setSymptoms] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("female");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCheck = async () => {
    if (symptoms.trim().length < 5) {
      showAlert({ title: "Error", message: "Please describe your symptoms (at least 5 characters)" });
      return;
    }
    console.log("[ACTION] Checking symptoms, age:", age, "gender:", gender);
    setLoading(true);
    setResult(null);
    try {
      const res = await healthApi.checkSymptoms({
        symptoms: symptoms.trim(),
        age: age ? parseInt(age) : undefined,
        gender,
      });
      if (res.data) {
        console.log("[CRUD:READ] Successfully fetched symptom check results");
        setResult(res.data);
      } else {
        console.log("[CRUD:READ] Failed to check symptoms", res.error);
        showAlert({ title: "Error", message: res.error || "Failed to check symptoms" });
      }
    } catch (err: any) {
      console.log("[CRUD:READ] Network error checking symptoms", err);
      showAlert({ title: "Error", message: err.message || "Network error" });
    }
    setLoading(false);
  };

  const riskColor = (level: string) => {
    if (level === "Critical") return "#B91C1C";
    if (level === "High") return "#D97706";
    if (level === "Medium") return "#CA8A04";
    return colors.primary;
  };

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.inputLabel}>Describe your symptoms</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: "top" }]}
        placeholder="e.g. I have headache and mild fever since yesterday..."
        placeholderTextColor={colors.muted}
        value={symptoms}
        onChangeText={setSymptoms}
        multiline
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.inputLabel}>Age</Text>
          <TextInput
            style={styles.input}
            placeholder="30"
            placeholderTextColor={colors.muted}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.inputLabel}>Gender</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {["male", "female"].map(g => (
              <Pressable
                key={g}
                style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Button
        label="CHECK SYMPTOMS"
        icon={<Ionicons name="pulse-outline" size={18} color={colors.ink} />}
        onPress={handleCheck}
        loading={loading}
        style={styles.modernPrimaryBtn}
      />

      {/* Results */}
      {result && (
        <View style={styles.resultCard}>
          <View style={[styles.riskBadge, { backgroundColor: riskColor(result.risk_level) + "22", borderColor: riskColor(result.risk_level) + "44" }]}>
            <Text style={[styles.riskText, { color: riskColor(result.risk_level) }]}>
              {result.risk_level?.toUpperCase()} RISK
            </Text>
          </View>

          {result.urgency && (
            <Text style={styles.urgencyText}>Urgency: {result.urgency}</Text>
          )}

          <Text style={styles.resultSection}>Possible Conditions</Text>
          {(result.possible_conditions || []).map((c: string, i: number) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={styles.bulletText}>{c}</Text>
            </View>
          ))}

          <Text style={styles.resultSection}>Recommended Action</Text>
          <Text style={styles.resultBody}>{result.recommended_action}</Text>

          {result.home_remedies?.length > 0 && (
            <>
              <Text style={styles.resultSection}>Home Remedies</Text>
              {result.home_remedies.map((r: string, i: number) => (
                <View key={i} style={styles.bulletRow}>
                  <Ionicons name="leaf-outline" size={12} color={colors.primary} />
                  <Text style={styles.bulletText}>{r}</Text>
                </View>
              ))}
            </>
          )}

          {result.warning_signs?.length > 0 && (
            <>
              <Text style={[styles.resultSection, { color: "#B91C1C" }]}>⚠️ Warning Signs</Text>
              {result.warning_signs.map((w: string, i: number) => (
                <View key={i} style={styles.bulletRow}>
                  <Ionicons name="warning-outline" size={12} color="#B91C1C" />
                  <Text style={styles.bulletText}>{w}</Text>
                </View>
              ))}
            </>
          )}

          {result.disclaimer && (
            <Text style={styles.disclaimer}>{result.disclaimer}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

/* ═══ Report Issue (Complaint Filing) ═══ */
function ReportIssueView({ showAlert }: { showAlert: any }) {
  const [portalName, setPortalName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complaints, setComplaints] = useState<any[]>([]);

  const fetchComplaints = useCallback(async () => {
    console.log("[CRUD:READ] Fetching previous complaints");
    try {
      const res = await governmentApi.listComplaints();
      if (res.data?.complaints) {
        console.log(`[CRUD:READ] Fetched ${res.data.complaints.length} complaints`);
        setComplaints(res.data.complaints);
      }
    } catch (err) {
      console.log("[CRUD:READ] Error fetching complaints", err);
    }
  }, []);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const handleSubmit = async () => {
    if (!portalName.trim() || !description.trim()) {
      showAlert({ title: "Error", message: "Portal name and description are required" });
      return;
    }
    setSubmitting(true);
    console.log(`[ACTION] Submitting new complaint for portal: ${portalName}`);
    try {
      const refNo = `RURAL-${Date.now().toString(36).toUpperCase()}`;
      const res = await governmentApi.createComplaint({
        portalName: portalName.trim(),
        referenceNo: refNo,
        description: description.trim(),
      });
      if (!res.error) {
        console.log(`[CRUD:CREATE] Successfully filed complaint with ref ${refNo}`);
        showAlert({ title: "✅ Complaint Filed", message: `Reference: ${refNo}` });
        setPortalName("");
        setDescription("");
        await fetchComplaints();
      } else {
        console.log("[CRUD:CREATE] Failed to file complaint", res.error);
        showAlert({ title: "Error", message: res.error });
      }
    } catch (err: any) {
      console.log("[CRUD:CREATE] Error filing complaint", err);
      showAlert({ title: "Error", message: err.message || "Failed to file complaint" });
    }
    setSubmitting(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.inputLabel}>Portal / Department</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. CPGRAMS, PWD, PHC"
        placeholderTextColor={colors.muted}
        value={portalName}
        onChangeText={setPortalName}
      />

      <Text style={styles.inputLabel}>Describe the issue</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: "top" }]}
        placeholder="Road repair needed, water supply issue, electricity outage..."
        placeholderTextColor={colors.muted}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Button
        label="FILE COMPLAINT"
        icon={<Ionicons name="flag-outline" size={18} color={colors.ink} />}
        onPress={handleSubmit}
        loading={submitting}
        style={styles.modernPrimaryBtn}
      />

      {complaints.length > 0 && (
        <>
          <Text style={[styles.resultSection, { marginTop: 20 }]}>Your Complaints</Text>
          {complaints.map((c: any, i: number) => (
            <View key={i} style={styles.complaintCard}>
              <Text style={styles.complaintRef}>#{c.reference_no || c.referenceNo}</Text>
              <Text style={styles.complaintDesc} numberOfLines={2}>{c.description}</Text>
              <View style={[styles.statusChip, { backgroundColor: c.status === "open" ? "rgba(19,236,91,0.14)" : "rgba(139,94,60,0.10)" }]}>
                <Text style={styles.statusChipText}>{(c.status || "open").toUpperCase()}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

/* ═══ Health Articles ═══ */
function HealthArticlesView({ showAlert }: { showAlert: any }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchArticles = useCallback(async () => {
    console.log("[CRUD:READ] Fetching health articles");
    try {
      const res = await healthApi.listArticles();
      if (res.data?.articles) {
        console.log(`[CRUD:READ] Fetched ${res.data.articles.length} health articles`);
        setArticles(res.data.articles);
      }
    } catch (err) {
      console.log("[CRUD:READ] Error fetching articles", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const handleGenerate = async (topic: string) => {
    setGenerating(true);
    console.log(`[ACTION] Prompting to generate article on topic: ${topic}`);
    try {
      const res = await healthApi.generateArticle(topic, "en");
      if (res.data?.article) {
        console.log(`[CRUD:CREATE] Successfully generated article: ${res.data.article.title}`);
        showAlert({ title: "✅ Article Generated", message: res.data.article.title });
        await fetchArticles();
      } else {
        console.log("[CRUD:CREATE] Failed to generate article, no data returned", res.error);
        showAlert({ title: "Info", message: res.error || "Article generation returned no data" });
      }
    } catch (err: any) {
      console.log("[CRUD:CREATE] Error generating article", err);
      showAlert({ title: "Error", message: err.message || "Failed to generate" });
    }
    setGenerating(false);
  };

  if (loading) {
    return <View style={styles.loadingCenter}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* Quick generate */}
      <Text style={styles.inputLabel}>Generate an article</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {["nutrition", "diabetes", "hygiene", "mental_health", "maternal_health"].map(t => (
          <Pressable key={t} style={styles.topicChip} onPress={() => handleGenerate(t)} disabled={generating}>
            <Text style={styles.topicText}>{t.replace("_", " ").replace(/^\w/, c => c.toUpperCase())}</Text>
          </Pressable>
        ))}
      </View>
      {generating && <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />}

      {articles.length > 0 && (
        <>
          <Text style={styles.resultSection}>Articles</Text>
          {articles.map((a: any, i: number) => (
            <View key={i} style={styles.articleCard}>
              <Text style={styles.articleTitle}>{a.title}</Text>
              <Text style={styles.articleTopic}>{a.topic || "health"}</Text>
              {a.sections?.slice(0, 1).map((s: any, j: number) => (
                <Text key={j} style={styles.articleBody} numberOfLines={3}>{s.content}</Text>
              ))}
            </View>
          ))}
        </>
      )}

      {articles.length === 0 && !generating && (
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={28} color={colors.muted} />
          <Text style={styles.emptyText}>No articles yet. Tap a topic above to generate one!</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ═══ Govt Portals List ═══ */
function GovtPortalsView() {
  const [portals, setPortals] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    console.log("[CRUD:READ] Fetching Govt. portals or providers...");
    try {
      const res = await governmentApi.listPortals();
      if (res.data?.portals) {
        console.log(`[CRUD:READ] Fetched ${res.data.portals.length} portals`);
        setPortals(res.data.portals);
      }
    } catch (err) {
      console.log("[CRUD:READ] Error fetching portals", err);
    }
    try {
      const res = await healthApi.listProviders();
      if (res.data?.providers) {
        console.log(`[CRUD:READ] Fetched ${res.data.providers.length} providers`);
        setProviders(res.data.providers);
      }
    } catch (err) {
      console.log("[CRUD:READ] Error fetching providers", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <View style={styles.loadingCenter}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {portals.length > 0 && (
        <>
          <Text style={styles.resultSection}>Government Portals</Text>
          {portals.map((p: any, i: number) => (
            <View key={i} style={styles.portalCard}>
              <Text style={styles.portalName}>{p.name}</Text>
              <Text style={styles.portalDesc} numberOfLines={2}>{p.description}</Text>
              {p.category && (
                <View style={styles.categoryChip}>
                  <Text style={styles.categoryText}>{p.category}</Text>
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {providers.length > 0 && (
        <>
          <Text style={[styles.resultSection, { marginTop: 16 }]}>Health Providers</Text>
          {providers.map((p: any, i: number) => (
            <View key={i} style={styles.portalCard}>
              <Text style={styles.portalName}>{p.name}</Text>
              <Text style={styles.portalDesc}>{p.type} • {p.city || p.location}</Text>
              {p.phone && <Text style={styles.portalDesc}>📞 {p.phone}</Text>}
            </View>
          ))}
        </>
      )}

      {portals.length === 0 && providers.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={28} color={colors.muted} />
          <Text style={styles.emptyText}>No portal data available. Check backend connection.</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ═══ Medical Scans (Metriport API) ═══ */

function MedicalScansView({ showAlert }: { showAlert: any }) {
  const [imagingType, setImagingType] = useState('xray');
  const [description, setDescription] = useState('');
  const [presignedUrl, setPresignedUrl] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
    }
  };

  const handleInitiateUpload = async () => {
    if (!selectedImage) {
      showAlert({ title: "Error", message: "Please select an image first." });
      return;
    }
    setLoading(true);
    setAnalysis(null);
    console.log(`[ACTION] Initiating medical scan upload. Type: ${imagingType}`);
    try {
      const contentType = selectedImage.mimeType || 'image/jpeg';
      const res = await healthApi.initiateUpload({
        imagingType,
        description,
        contentType
      });
      if (res.data?.uploadUrl) {
        setPresignedUrl(res.data.uploadUrl);
        setDocumentId(res.data.documentId);
        console.log(`[CRUD:CREATE] Successfully obtained S3 Upload URL`);
      } else {
        showAlert({ title: "Error", message: res.error || "Failed to initiate upload" });
      }
    } catch (err: any) {
      console.log(`[CRUD:CREATE] Error obtaining upload url`, err);
      showAlert({ title: "Error", message: err.message || "Network Error" });
    }
    setLoading(false);
  };

  const executeUploadAndAnalyze = async () => {
    if (!selectedImage || !presignedUrl) return;
    setUploading(true);

    try {
      console.log(`[NETWORK] Uploading file to S3...`);
      const response = await fetch(selectedImage.uri);
      const blob = await response.blob();
      const contentType = selectedImage.mimeType || 'image/jpeg';

      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': contentType,
        }
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.log(`[NETWORK] S3 Upload Failed. Status: ${uploadRes.status}, Body: ${errText}`);
        throw new Error(`S3 Upload Failed (${uploadRes.status})`);
      }
      console.log(`[NETWORK] S3 Upload successful!`);

      console.log(`[ACTION] Requesting AI Analysis for Doc ID: ${documentId}`);
      const analyzeRes = await healthApi.analyzeImage(documentId, imagingType);

      if (analyzeRes.data?.analysis) {
        setAnalysis(analyzeRes.data.analysis);
        showAlert({ title: "✅ Upload Complete", message: "Medical scan analyzed successfully." });
      } else {
        showAlert({ title: "Analysis Failed", message: analyzeRes.error || "Could not retrieve observations." });
      }
    } catch (err: any) {
      console.error(err);
      showAlert({ title: "Error", message: err.message || "Failed to process image." });
    }

    setUploading(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.inputLabel}>Scan Type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        {["xray", "mri", "ct-scan", "ultrasound"].map(t => (
          <Pressable
            key={t}
            style={[styles.genderBtn, imagingType === t && styles.genderBtnActive]}
            onPress={() => setImagingType(t)}
          >
            <Text style={[styles.genderText, imagingType === t && styles.genderTextActive]}>
              {t.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.inputLabel}>Select Image</Text>
      {selectedImage ? (
        <View style={{ marginBottom: 16 }}>
          <View style={{
            height: 180,
            borderRadius: 14,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Image
              source={{ uri: selectedImage.uri }}
              style={{ width: "100%", height: "100%", resizeMode: "cover" }}
            />
          </View>
          <Pressable
            style={{
              marginTop: 8,
              alignSelf: 'flex-start',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: "rgba(220, 38, 38, 0.1)"
            }}
            onPress={() => setSelectedImage(null)}
          >
            <Text style={{ color: "#DC2626", fontSize: 12, fontWeight: "800" }}>Remove Image</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={{
            height: 120,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: colors.primary,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(19,236,91,0.05)",
            marginBottom: 16
          }}
          onPress={handlePickImage}
        >
          <Ionicons name="image-outline" size={32} color={colors.primary} />
          <Text style={{ marginTop: 8, fontSize: 12, fontWeight: "800", color: colors.earth }}>
            Tap to select an image from your gallery
          </Text>
        </Pressable>
      )}

      <Text style={styles.inputLabel}>Description (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Chest X-Ray from City Hospital"
        placeholderTextColor={colors.muted}
        value={description}
        onChangeText={setDescription}
      />

      {!presignedUrl ? (
        <Button
          label="START UPLOAD"
          icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.ink} />}
          onPress={handleInitiateUpload}
          loading={loading}
          style={styles.modernPrimaryBtn}
        />
      ) : (
        <View style={styles.resultCard}>
          <Text style={styles.resultSection}>Upload Ready</Text>
          <Text style={styles.resultBody}>Secure tunnel established. Tap confirm to upload your image to S3 and pass it to Claude 3 Vision AI.</Text>
          <Button
            label="CONFIRM & ANALYZE"
            icon={<Ionicons name="checkmark-circle-outline" size={18} color={colors.ink} />}
            onPress={executeUploadAndAnalyze}
            loading={uploading}
            style={Object.assign({}, styles.modernPrimaryBtn, { marginTop: 12, backgroundColor: '#059669' }) as any}
          />
        </View>
      )}

      {/* Bedrock AI Results */}
      {analysis && (
        <View style={Object.assign({}, styles.resultCard, { borderColor: '#10B981', borderWidth: 2 }) as any}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="bed-outline" size={20} color="#10B981" />
            <Text style={Object.assign({}, styles.resultSection, { marginTop: 0, color: '#10B981' }) as any}>AI Observations</Text>
          </View>

          <Text style={Object.assign({}, styles.inputLabel, { marginTop: 12 }) as any}>General Information</Text>
          <Text style={styles.resultBody}>{analysis.general_info}</Text>

          <Text style={Object.assign({}, styles.inputLabel, { marginTop: 12 }) as any}>Common Findings Reviewed</Text>
          {(analysis.common_findings || []).map((f: string, i: number) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={styles.bulletText}>{f}</Text>
            </View>
          ))}

          <Text style={Object.assign({}, styles.inputLabel, { marginTop: 12 }) as any}>Next Steps for Patient</Text>
          <Text style={styles.resultBody}>{analysis.next_steps}</Text>

          <View style={{ backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8, marginTop: 12 }}>
            <Text style={Object.assign({}, styles.inputLabel, { color: '#B91C1C', marginBottom: 2 }) as any}>Important</Text>
            <Text style={Object.assign({}, styles.resultBody, { color: '#B91C1C' }) as any}>{analysis.important_note}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

/* ═══ Coming Soon (fallback) ═══ */
function ComingSoonView({ actionTitle }: { actionTitle: string }) {
  return (
    <View style={styles.comingSoon}>
      <View style={styles.comingSoonIcon}>
        <Ionicons name="construct-outline" size={32} color={colors.earth} />
      </View>
      <Text style={styles.comingSoonTitle}>{actionTitle}</Text>
      <Text style={styles.comingSoonSub}>This feature is coming soon. We're working on integrating it with real data.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingTop: 6, flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: 16, fontWeight: "900", color: colors.ink },
  hSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: colors.muted },

  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },

  inputLabel: { fontSize: 12, fontWeight: "900", color: colors.earth, letterSpacing: 0.6, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 12 },

  genderBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(139,94,60,0.08)", borderWidth: 1, borderColor: "rgba(139,94,60,0.18)", alignItems: "center", marginBottom: 12 },
  genderBtnActive: { backgroundColor: colors.primary, borderColor: "rgba(19,236,91,0.45)" },
  genderText: { fontSize: 12, fontWeight: "900", color: colors.earth },
  genderTextActive: { color: colors.ink },

  primaryBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 },
  primaryText: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: colors.ink },

  resultCard: { marginTop: 16, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  riskBadge: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  riskText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  urgencyText: { fontSize: 12, fontWeight: "800", color: colors.muted },
  resultSection: { fontSize: 14, fontWeight: "900", color: colors.ink, marginTop: 8 },
  resultBody: { fontSize: 12, fontWeight: "700", color: colors.ink, lineHeight: 17 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 4 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 5 },
  bulletText: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.ink, lineHeight: 17 },
  disclaimer: { marginTop: 12, fontSize: 10, fontWeight: "700", color: colors.muted, fontStyle: "italic", lineHeight: 14 },

  complaintCard: { marginTop: 8, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  complaintRef: { fontSize: 12, fontWeight: "900", color: colors.earth },
  complaintDesc: { fontSize: 12, fontWeight: "700", color: colors.ink },
  statusChip: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 4 },
  statusChipText: { fontSize: 10, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },

  topicChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(139,94,60,0.08)", borderWidth: 1, borderColor: "rgba(139,94,60,0.18)" },
  topicText: { fontSize: 12, fontWeight: "900", color: colors.earth },

  articleCard: { marginTop: 8, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  articleTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  articleTopic: { fontSize: 11, fontWeight: "800", color: colors.earth },
  articleBody: { fontSize: 12, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  portalCard: { marginTop: 8, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  portalName: { fontSize: 13, fontWeight: "900", color: colors.ink },
  portalDesc: { fontSize: 12, fontWeight: "700", color: colors.muted },
  categoryChip: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(139,94,60,0.10)", borderWidth: 1, borderColor: "rgba(139,94,60,0.18)", marginTop: 4 },
  categoryText: { fontSize: 10, fontWeight: "900", color: colors.earth, letterSpacing: 0.4 },

  emptyState: { alignItems: "center", paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 12, fontWeight: "700", color: colors.muted, textAlign: "center" },

  comingSoon: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 12 },
  comingSoonIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(139,94,60,0.10)", alignItems: "center", justifyContent: "center" },
  comingSoonTitle: { fontSize: 16, fontWeight: "900", color: colors.ink },
  comingSoonSub: { fontSize: 12, fontWeight: "700", color: colors.muted, textAlign: "center", lineHeight: 18 },
  modernPrimaryBtn: {
    height: 56,
    borderRadius: 16,
    marginBottom: 8,
  },
});
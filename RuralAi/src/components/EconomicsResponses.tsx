import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { ruralPalette as P } from "../theme/ruralPalette";
import { useEconomicProfile, useInsuranceClaims, useMemoryFacts, useNudges, useSchemes } from "../hooks/useData";
import type { Scheme } from "../services/api";

type IoniconName = keyof typeof Ionicons.glyphMap;
type StatusTone = "good" | "warn" | "muted";

type SeasonalExpense = {
  category: string;
  amount_inr: number;
  due_month?: string;
};

type SeedProfile = {
  farmerName: string;
  state: string;
  district: string;
  primaryCrop: string;
  cropTypes: string[];
  landSizeAcres: number;
  annualIncomeInr: number;
  expectedHarvestIncomeInr: number;
  harvestMonths: string[];
  seasonalExpenses: SeasonalExpense[];
  hasBankAccount: boolean;
  hasKcc: boolean;
  digilockerVerified: boolean;
  insuranceProvider: string | null;
  hasProfileData: boolean;
  hasLoanInputs: boolean;
};

export type ResponseAction = {
  label: string;
  icon: IoniconName;
  onPress?: () => void;
};

export type StatusItemModel = {
  label: string;
  value: string;
  tone: StatusTone;
  icon: IoniconName;
};

export type OfferCardModel = {
  id: string;
  title: string;
  subtitle: string;
  amountLabel: string;
  amountValue: string;
  rateLabel: string;
  rateValue: string;
  confidence: number;
  icon: IoniconName;
  buttonLabel: string;
};

export type LoanEligibilityModel = {
  loading: boolean;
  available: boolean;
  prompt: string;
  intro: string;
  spokenText: string;
  readinessScore: number;
  matchedSchemeCount: number;
  documentsReady: number;
  totalDocuments: number;
  profileSummary: string;
  statusItems: StatusItemModel[];
  offers: OfferCardModel[];
  waitingMessage?: string;
};

export type AllocationModel = {
  key: string;
  title: string;
  amount: number;
  subtitle: string;
  icon: IoniconName;
};

export type FinancialOverviewModel = {
  loading: boolean;
  prompt: string;
  intro: string;
  spokenText: string;
  harvestIncome: number;
  plannedCosts: number;
  netIncome: number;
  savingsTarget: number;
  savingsPercent: number;
  emergencyBuffer: number;
  profitPercent: number;
  costPercent: number;
  harvestLabel: string;
  allocations: AllocationModel[];
  nudge: string;
  highlights: string[];
};

export type ClaimStepModel = {
  title: string;
  body: string;
};

export type ClaimCardModel = {
  id: string;
  title: string;
  status: string;
  dateLabel: string;
  claimedAmount: number;
  approvedAmount?: number;
  readinessScore: number;
};

export type InsuranceModel = {
  loading: boolean;
  prompt: string;
  intro: string;
  spokenText: string;
  coverageScheme: string;
  coverageAmount: number;
  premiumLabel: string;
  readinessScore: number;
  nextDocuments: string[];
  steps: ClaimStepModel[];
  claims: ClaimCardModel[];
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const LOAN_VISUALS: Record<string, Pick<OfferCardModel, "amountLabel" | "amountValue" | "rateLabel" | "rateValue" | "icon">> = {
  "kisan-credit-card": {
    amountLabel: "Loan limit",
    amountValue: "Up to ₹3,00,000",
    rateLabel: "Interest support",
    rateValue: "Starts near 4% with timely repayment",
    icon: "wallet",
  },
  "agriculture-infrastructure-fund": {
    amountLabel: "Project support",
    amountValue: "Medium to long-term farm financing",
    rateLabel: "Interest subvention",
    rateValue: "Up to 3% support on eligible projects",
    icon: "business",
  },
};

const INSURANCE_SCHEME_COPY: Record<string, { scheme: string; premiumLabel: string; coverageFactor: number }> = {
  pmfby: {
    scheme: "PM Fasal Bima Yojana",
    premiumLabel: "Premium support starts near 1.5% to 2% for notified crops",
    coverageFactor: 0.5,
  },
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1", "linked", "verified"].includes(normalized)) return true;
    if (["false", "no", "n", "0"].includes(normalized)) return false;
  }
  return fallback;
}

function capitalizeWords(input: string) {
  return String(input || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCurrency(value: number) {
  return `₹${Math.round(Math.max(0, value)).toLocaleString("en-IN")}`;
}

function normalizeFactMap(raw: unknown): Record<string, string> {
  if (!raw) return {};

  if (Array.isArray(raw)) {
    const map: Record<string, string> = {};
    raw.forEach((entry: any) => {
      if (entry?.factKey) map[String(entry.factKey)] = String(entry.factValue ?? "");
    });
    return map;
  }

  if (typeof raw === "object") {
    const source = (raw as any).facts && typeof (raw as any).facts === "object" ? (raw as any).facts : raw;
    return Object.fromEntries(
      Object.entries(source as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")])
    );
  }

  return {};
}

function normalizeMonthList(raw: unknown) {
  const months = asArray<string | number>(raw)
    .map((value) => {
      if (typeof value === "number") {
        const monthName = MONTH_NAMES[clamp(Math.round(value) - 1, 0, MONTH_NAMES.length - 1)];
        return monthName;
      }
      const trimmed = String(value || "").trim();
      if (!trimmed) return "";
      const monthIndex = MONTH_NAMES.findIndex((month) => month.toLowerCase() === trimmed.toLowerCase());
      return monthIndex >= 0 ? MONTH_NAMES[monthIndex] : capitalizeWords(trimmed);
    })
    .filter(Boolean);

  return months.length > 0 ? months : ["October", "November"];
}

function normalizeSeasonalExpenses(raw: unknown, expectedHarvestIncomeInr: number): SeasonalExpense[] {
  const expenses = asArray<any>(raw)
    .map((entry) => ({
      category: String(entry?.category ?? "Farm expense"),
      amount_inr: toNumber(entry?.amount_inr ?? entry?.amount ?? entry?.value),
      due_month: entry?.due_month ? String(entry.due_month) : undefined,
    }))
    .filter((entry) => entry.amount_inr > 0);

  if (expenses.length > 0) return expenses;

  const base = expectedHarvestIncomeInr > 0 ? expectedHarvestIncomeInr : 180000;
  return [
    { category: "Seeds", amount_inr: Math.round(base * 0.08), due_month: "June" },
    { category: "Fertilizer", amount_inr: Math.round(base * 0.11), due_month: "July" },
    { category: "Irrigation", amount_inr: Math.round(base * 0.07), due_month: "August" },
    { category: "Labour", amount_inr: Math.round(base * 0.1), due_month: "September" },
  ];
}

function fallbackCropTypes(facts: Record<string, string>) {
  const explicit = String(facts.crop_types || facts.crops || "").trim();
  if (explicit) {
    return explicit
      .split(/[|,]/)
      .map((part) => capitalizeWords(part.trim()))
      .filter(Boolean);
  }

  const primary = capitalizeWords(facts.primary_crop || facts.crop || "Wheat");
  return [primary];
}

function useSeedProfile(): SeedProfile {
  const profileQuery = useEconomicProfile();
  const memoryFactsQuery = useMemoryFacts();

  return useMemo(() => {
    const facts = normalizeFactMap(memoryFactsQuery.data as any);
    const profile = (profileQuery.data as any) && typeof profileQuery.data === "object" ? (profileQuery.data as any) : {};
    const rawCropTypes = asArray<string>(profile.crop_types)
      .map((crop) => capitalizeWords(String(crop)))
      .filter(Boolean);
    const factCropTypes = fallbackCropTypes(facts);
    const rawPrimaryCrop = rawCropTypes[0] ?? factCropTypes[0] ?? "";
    const rawState = String(profile.state ?? facts.state ?? "").trim();
    const rawDistrict = String(profile.district ?? facts.district ?? "").trim();
    const rawFarmerName = String(profile.full_name ?? facts.user_name ?? facts.name ?? "").trim();
    const rawLandSize = toNumber(profile.land_size_acres ?? facts.land_size_acres ?? facts.land_size ?? facts.land);
    const hasProfileData = Boolean(rawFarmerName || rawPrimaryCrop || rawState || rawLandSize > 0);
    const hasLoanInputs = Boolean(rawPrimaryCrop) && rawLandSize > 0;

    const cropTypes = rawCropTypes;
    const resolvedCropTypes = cropTypes.length > 0 ? cropTypes : factCropTypes;
    const expectedHarvestIncomeInr = toNumber(
      profile.expected_harvest_income_inr
        ?? facts.expected_harvest_income_inr
        ?? facts.expected_harvest_income
        ?? facts.harvest_income,
      180000
    );
    const annualIncomeInr = toNumber(
      profile.annual_income_inr ?? facts.annual_income_inr ?? facts.annual_income,
      Math.round(expectedHarvestIncomeInr * 1.35)
    );

    return {
      farmerName: rawFarmerName || "Farmer",
      state: rawState || "Unknown",
      district: rawDistrict || "",
      primaryCrop: resolvedCropTypes[0] ?? "",
      cropTypes: resolvedCropTypes,
      landSizeAcres: rawLandSize,
      annualIncomeInr,
      expectedHarvestIncomeInr,
      harvestMonths: normalizeMonthList(profile.harvest_months ?? facts.harvest_months),
      seasonalExpenses: normalizeSeasonalExpenses(profile.seasonal_expenses, expectedHarvestIncomeInr),
      hasBankAccount: toBoolean(profile.has_bank_account ?? facts.has_bank_account ?? facts.bank_account, true),
      hasKcc: toBoolean(profile.has_kcc ?? facts.has_kcc, false),
      digilockerVerified: toBoolean(
        profile.digilocker_verified ?? facts.digilocker_verified ?? facts.kyc_verified,
        false
      ),
      insuranceProvider: profile.insurance_provider ? String(profile.insurance_provider) : null,
      hasProfileData,
      hasLoanInputs,
    };
  }, [memoryFactsQuery.data, profileQuery.data]);
}

function evaluateSchemeEligibility(profile: SeedProfile, scheme: Scheme) {
  const gaps: string[] = [];

  if (profile.landSizeAcres < toNumber((scheme as any).min_land_acres, 0)) {
    gaps.push("land");
  }
  if ((scheme as any).requires_bank_account && !profile.hasBankAccount) {
    gaps.push("bank");
  }
  if (!profile.digilockerVerified) {
    gaps.push("digilocker");
  }

  return {
    eligible: gaps.length === 0,
    confidence: gaps.length === 0 ? 88 : Math.max(45, 80 - gaps.length * 12),
  };
}

function buildSavingsNumbers(profile: SeedProfile) {
  const harvestIncome = Math.max(profile.expectedHarvestIncomeInr, 0);
  const plannedCosts = profile.seasonalExpenses.reduce((sum, item) => sum + Math.max(item.amount_inr, 0), 0);
  const savingsTarget = Math.round(harvestIncome * 0.3);
  const emergencyBuffer = Math.round(harvestIncome * 0.1);
  const costPercent = harvestIncome > 0 ? clamp(Math.round((plannedCosts / harvestIncome) * 100), 5, 88) : 35;
  const profitPercent = clamp(100 - costPercent, 12, 95);

  return {
    harvestIncome,
    plannedCosts,
    savingsTarget,
    emergencyBuffer,
    netIncome: Math.max(harvestIncome - plannedCosts, 0),
    savingsPercent: harvestIncome > 0 ? Math.round((savingsTarget / harvestIncome) * 100) : 0,
    profitPercent,
    costPercent,
  };
}

function summarizeHarvestStatus(netIncome: number, harvestIncome: number) {
  if (!harvestIncome) return "Add your expected harvest income to see a clearer farm economy summary.";
  const margin = netIncome / harvestIncome;
  if (margin >= 0.55) return "Harvest cash flow looks healthy. You can protect profit and still build reserves.";
  if (margin >= 0.35) return "Harvest margins are workable. Watch costs closely and move savings first.";
  return "Harvest margins look tight right now. Prioritize essential costs and emergency savings first.";
}

function statusToneColor(tone: StatusTone) {
  switch (tone) {
    case "good":
      return { bg: "#E7F4DE", fg: "#6F8F3C" };
    case "warn":
      return { bg: "#FFF0CF", fg: "#A06B0A" };
    default:
      return { bg: "#F4EBDD", fg: P.mutedDark };
  }
}

function claimStatusMeta(status: string) {
  const normalized = String(status || "draft_ready").toLowerCase();
  if (normalized.includes("ready") || normalized.includes("approved")) {
    return { label: "Ready", color: "#6F8F3C", bg: "#E7F4DE" };
  }
  if (normalized.includes("await") || normalized.includes("pending")) {
    return { label: "Pending", color: "#A06B0A", bg: "#FFF0CF" };
  }
  if (normalized.includes("reject")) {
    return { label: "Rejected", color: "#9E4A42", bg: "#F8D8D2" };
  }
  return { label: capitalizeWords(normalized.replace(/_/g, " ")), color: P.mutedDark, bg: "#F4EBDD" };
}

export function useLoanEligibilityModel(): LoanEligibilityModel {
  const profile = useSeedProfile();
  const schemesQuery = useSchemes("loan", profile.state);

  return useMemo(() => {
    const allSchemes = asArray<Scheme>((schemesQuery.data as any)?.schemes)
      .filter((scheme) => String((scheme as any).type || "").toLowerCase() === "loan");
    const isWaitingForData = schemesQuery.loading || !profile.hasProfileData;
    const hasRealData = profile.hasLoanInputs && allSchemes.length > 0;

    if (!hasRealData) {
      return {
        loading: isWaitingForData,
        available: false,
        prompt: 'Tap to speak. E.g., "Am I eligible for a crop loan?"',
        intro: isWaitingForData
          ? "Loading your loan eligibility data."
          : "Loan eligibility will appear after your farm profile and scheme data are available.",
        spokenText: isWaitingForData
          ? "Loading your loan eligibility data."
          : "Loan eligibility will appear after your farm profile and scheme data are available.",
        readinessScore: 0,
        matchedSchemeCount: 0,
        documentsReady: 0,
        totalDocuments: 3,
        profileSummary: profile.hasProfileData
          ? [profile.primaryCrop, profile.landSizeAcres > 0 ? `${profile.landSizeAcres.toFixed(1)} acres` : "", profile.state !== "Unknown" ? profile.state : ""]
              .filter(Boolean)
              .join(" • ")
          : "Waiting for farm profile",
        statusItems: [],
        offers: [],
        waitingMessage: isWaitingForData
          ? "Please wait while we load your profile and matching loan schemes."
          : "No live loan profile data is available yet.",
      };
    }

    const assessedSchemes = allSchemes
      .map((scheme) => ({ scheme, assessment: evaluateSchemeEligibility(profile, scheme) }))
      .sort((left, right) => right.assessment.confidence - left.assessment.confidence);

    const topOffers = assessedSchemes.slice(0, 2).map(({ scheme, assessment }) => {
      const visual = LOAN_VISUALS[scheme.id] ?? {
        amountLabel: "Support",
        amountValue: scheme.benefit_summary || scheme.summary,
        rateLabel: "Provider",
        rateValue: scheme.provider,
        icon: "cash" as IoniconName,
      };

      return {
        id: scheme.id,
        title: scheme.name,
        subtitle: scheme.summary,
        amountLabel: visual.amountLabel,
        amountValue: visual.amountValue,
        rateLabel: visual.rateLabel,
        rateValue: visual.rateValue,
        confidence: assessment.confidence,
        icon: visual.icon,
        buttonLabel: "Check eligibility to know more",
      };
    });

    const readinessScore = Math.round(
      assessedSchemes.reduce((sum, item) => sum + item.assessment.confidence, 0) / Math.max(assessedSchemes.length, 1)
    );
    const matchedSchemeCount = assessedSchemes.filter((item) => item.assessment.eligible).length;
    const documentsReady = [profile.hasBankAccount, profile.digilockerVerified, profile.landSizeAcres >= 0.25].filter(Boolean).length;
    const totalDocuments = 3;
    const intro = matchedSchemeCount > 0
      ? `${matchedSchemeCount} loan option${matchedSchemeCount > 1 ? "s" : ""} look ready for your current farm profile.`
      : "Your loan offers improve once bank and DigiLocker details are complete.";
    const spokenText = matchedSchemeCount > 0
      ? `${topOffers[0]?.title ?? "A loan scheme"} is your strongest match. Readiness is ${readinessScore}% with ${documentsReady} of ${totalDocuments} key checks complete.`
      : `Your current loan readiness is ${readinessScore}%. Complete bank and DigiLocker checks to unlock stronger offers.`;

    return {
      loading: schemesQuery.loading,
      available: true,
      prompt: 'Tap to speak. E.g., "Am I eligible for a crop loan?"',
      intro,
      spokenText,
      readinessScore,
      matchedSchemeCount,
      documentsReady,
      totalDocuments,
      profileSummary: `${profile.primaryCrop} • ${profile.landSizeAcres.toFixed(1)} acres • ${profile.state}`,
      statusItems: [
        {
          label: "Land size",
          value: `${profile.landSizeAcres.toFixed(1)} acres`,
          tone: profile.landSizeAcres >= 1 ? "good" : "warn",
          icon: "leaf",
        },
        {
          label: "Bank account",
          value: profile.hasBankAccount ? "Linked" : "Pending",
          tone: profile.hasBankAccount ? "good" : "warn",
          icon: "card",
        },
        {
          label: "DigiLocker",
          value: profile.digilockerVerified ? "Verified" : "Pending",
          tone: profile.digilockerVerified ? "good" : "warn",
          icon: "shield-checkmark",
        },
        {
          label: "Primary crop",
          value: profile.primaryCrop,
          tone: "muted",
          icon: "nutrition",
        },
      ],
      offers: topOffers,
    };
  }, [profile, schemesQuery.data, schemesQuery.loading]);
}

export function useFinancialOverviewModel(): FinancialOverviewModel {
  const profile = useSeedProfile();
  const nudgesQuery = useNudges(4);

  return useMemo(() => {
    const numbers = buildSavingsNumbers(profile);
    const nudges = asArray<any>((nudgesQuery.data as any)?.nudges);
    const insuranceAllocation = Math.max(5000, Math.round(numbers.savingsTarget * 0.15));
    const nextSeasonAllocation = Math.max(numbers.savingsTarget - numbers.emergencyBuffer - insuranceAllocation, 0);
    const nudge = String(nudges[0]?.message ?? nudges[0]?.title ?? "")
      || summarizeHarvestStatus(numbers.netIncome, numbers.harvestIncome);

    return {
      loading: nudgesQuery.loading,
      prompt: 'Tap to speak. E.g., "How much should I save from my harvest?"',
      intro: summarizeHarvestStatus(numbers.netIncome, numbers.harvestIncome),
      spokenText: `Expected harvest income is ${formatCurrency(numbers.harvestIncome)}. Keep ${formatCurrency(numbers.savingsTarget)} aside, including ${formatCurrency(numbers.emergencyBuffer)} for emergencies.`,
      harvestIncome: numbers.harvestIncome,
      plannedCosts: numbers.plannedCosts,
      netIncome: numbers.netIncome,
      savingsTarget: numbers.savingsTarget,
      savingsPercent: numbers.savingsPercent,
      emergencyBuffer: numbers.emergencyBuffer,
      profitPercent: numbers.profitPercent,
      costPercent: numbers.costPercent,
      harvestLabel: `${profile.primaryCrop} harvest • ${profile.harvestMonths.join(", ")}`,
      allocations: [
        {
          key: "emergency",
          title: "Emergency Fund",
          amount: numbers.emergencyBuffer,
          subtitle: "Buffer for weather, health, and market shocks",
          icon: "alert-circle",
        },
        {
          key: "season",
          title: "Next Season Investment",
          amount: nextSeasonAllocation,
          subtitle: "Seeds, fertilizer, labour, and irrigation reserve",
          icon: "leaf",
        },
        {
          key: "insurance",
          title: "Insurance Protection",
          amount: insuranceAllocation,
          subtitle: "Premium and claim readiness support",
          icon: "shield-checkmark",
        },
      ],
      nudge,
      highlights: profile.seasonalExpenses.slice(0, 3).map((item) => `${item.category}: ${formatCurrency(item.amount_inr)}`),
    };
  }, [nudgesQuery.data, nudgesQuery.loading, profile]);
}

export function useInsuranceModel(): InsuranceModel {
  const profile = useSeedProfile();
  const claimsQuery = useInsuranceClaims(5);
  const schemesQuery = useSchemes("insurance", profile.state);

  return useMemo(() => {
    const claims = asArray<any>((claimsQuery.data as any)?.claims);
    const latestClaim = claims[0] ?? null;
    const insuranceSchemes = asArray<Scheme>((schemesQuery.data as any)?.schemes)
      .filter((scheme) => String((scheme as any).type || "").toLowerCase() === "insurance");
    const schemeId = String(latestClaim?.scheme_id ?? "pmfby");
    const schemeCopy = INSURANCE_SCHEME_COPY[schemeId] ?? INSURANCE_SCHEME_COPY.pmfby;
    const schemeName = insuranceSchemes[0]?.name ?? schemeCopy.scheme;
    const coverageAmount = toNumber(
      latestClaim?.approved_amount ?? latestClaim?.claimed_amount,
      Math.round(profile.expectedHarvestIncomeInr * schemeCopy.coverageFactor || 60000)
    );
    const readinessScore = toNumber(latestClaim?.damage_assessment?.claim_readiness_score, profile.digilockerVerified ? 82 : 66);
    const nextDocuments = asArray<string>(latestClaim?.damage_assessment?.next_documents).filter(Boolean);

    return {
      loading: claimsQuery.loading || schemesQuery.loading,
      prompt: 'Tap to speak. E.g., "My crop was damaged by rain."',
      intro: latestClaim
        ? `Your latest ${capitalizeWords(latestClaim.crop_type || profile.primaryCrop)} claim is ${claimStatusMeta(latestClaim.status).label.toLowerCase()}.`
        : `Coverage is ready for ${profile.primaryCrop.toLowerCase()} loss protection and faster claim filing.`,
      spokenText: latestClaim
        ? `${capitalizeWords(latestClaim.crop_type || profile.primaryCrop)} claim is ${claimStatusMeta(latestClaim.status).label.toLowerCase()} with readiness ${readinessScore}%.`
        : `${schemeName} can protect up to ${formatCurrency(coverageAmount)} based on your current crop income.`,
      coverageScheme: schemeName,
      coverageAmount,
      premiumLabel: schemeCopy.premiumLabel,
      readinessScore,
      nextDocuments: nextDocuments.length > 0
        ? nextDocuments
        : [
            "Aadhaar or farmer ID",
            "Land or crop record",
            "Photo evidence with date and location",
            "Bank account details for settlement",
          ],
      steps: [
        {
          title: "Upload crop damage photo",
          body: "Take clear field photos with the affected area visible.",
        },
        {
          title: "Confirm location",
          body: "Verify village, field coordinates, and loss date.",
        },
        {
          title: "Submit claim",
          body: "Review documents and send the claim for processing.",
        },
      ],
      claims: claims.slice(0, 2).map((claim) => ({
        id: String(claim.claimId ?? claim.claim_id ?? claim.id ?? Math.random()),
        title: `${capitalizeWords(claim.crop_type || profile.primaryCrop)} claim`,
        status: String(claim.status ?? "draft_ready"),
        dateLabel: String(claim.loss_date ?? claim.createdAt ?? claim.created_at ?? "Recently updated"),
        claimedAmount: toNumber(claim.claimed_amount, coverageAmount),
        approvedAmount: claim.approved_amount !== undefined ? toNumber(claim.approved_amount) : undefined,
        readinessScore: toNumber(claim.damage_assessment?.claim_readiness_score, readinessScore),
      })),
    };
  }, [claimsQuery.data, claimsQuery.loading, profile, schemesQuery.data, schemesQuery.loading]);
}

export function EconomicsHero({
  prompt,
  intro,
  onPress,
}: {
  prompt: string;
  intro?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.heroWrap}>
      <View style={styles.heroDotsLeft}>
        {[0, 1, 2].map((idx) => (
          <View key={`left-${idx}`} style={[styles.heroDot, idx === 1 && styles.heroDotTall]} />
        ))}
      </View>
      <View style={styles.heroDotsRight}>
        {[0, 1, 2].map((idx) => (
          <View key={`right-${idx}`} style={[styles.heroDot, idx === 1 && styles.heroDotTall]} />
        ))}
      </View>
      <Pressable style={({ pressed }) => [styles.heroButtonWrap, pressed && onPress ? styles.heroPressed : undefined]} onPress={onPress}>
        <View style={styles.heroOuterRing}>
          <View style={styles.heroInner}>
            <Ionicons name="mic" size={38} color={P.surface} />
          </View>
        </View>
      </Pressable>
      <Text style={styles.heroPrompt}>{prompt}</Text>
      {intro ? <Text style={styles.heroIntro}>{intro}</Text> : null}
    </View>
  );
}

export function LoanEligibilityView({
  model,
  compact = false,
  primaryAction,
}: {
  model: LoanEligibilityModel;
  compact?: boolean;
  primaryAction?: ResponseAction;
}) {
  const showLoading = model.loading && !model.available;

  return (
    <View style={styles.stack}>
      {showLoading ? <LoadingCard compact={compact} /> : null}

      {!model.available ? (
        <View style={[styles.emptyCard, compact && styles.summaryCardCompact]}>
          <View style={styles.summaryHeader}>
            <IconTile icon="hourglass" />
            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>Loan eligibility</Text>
              <Text style={styles.summaryText}>{model.waitingMessage ?? model.intro}</Text>
            </View>
          </View>
          {model.profileSummary ? <Text style={styles.summaryMeta}>{model.profileSummary}</Text> : null}
        </View>
      ) : null}

      {!model.available ? null : (
        <>
          <View style={[styles.summaryCard, compact && styles.summaryCardCompact]}>
            <View style={styles.summaryHeader}>
              <IconTile icon="analytics" />
              <View style={styles.summaryContent}>
                <Text style={styles.summaryTitle}>Loan readiness</Text>
                <Text style={styles.summaryText}>{model.intro}</Text>
              </View>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreBadgeValue}>{model.readinessScore}%</Text>
              </View>
            </View>
            <Text style={styles.summaryMeta}>{model.profileSummary}</Text>
          </View>

          <View style={styles.dualGrid}>
            <MetricCard
              compact={compact}
              icon="checkmark-circle"
              title="Eligible schemes"
              value={`${model.matchedSchemeCount}`}
              meta={model.matchedSchemeCount > 0 ? "Best matches based on land, bank, and KYC" : "Complete more checks to unlock matches"}
            />
            <MetricCard
              compact={compact}
              icon="document-text"
              title="Documents ready"
              value={`${model.documentsReady}/${model.totalDocuments}`}
              meta="Land, bank, and DigiLocker readiness"
            />
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Profile status</Text>
            <View style={styles.statusGrid}>
              {model.statusItems.map((item) => (
                <StatusPill key={item.label} item={item} />
              ))}
            </View>
          </View>

          {model.offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} compact={compact} action={primaryAction} />
          ))}
        </>
      )}
    </View>
  );
}

export function FinancialOverviewView({
  model,
  compact = false,
  primaryAction,
}: {
  model: FinancialOverviewModel;
  compact?: boolean;
  primaryAction?: ResponseAction;
}) {
  const showLoading = model.loading && model.allocations.length === 0;

  return (
    <View style={styles.stack}>
      {showLoading ? <LoadingCard compact={compact} /> : null}

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <IconTile icon="bar-chart" />
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Farm economy summary</Text>
            <Text style={styles.summaryText}>{model.intro}</Text>
          </View>
        </View>
        <Text style={styles.summaryMeta}>{model.harvestLabel}</Text>
      </View>

      <View style={styles.dualGrid}>
        <IncomeCard amount={model.harvestIncome} compact={compact} />
        <ProfitCostCard profitPercent={model.profitPercent} costPercent={model.costPercent} compact={compact} />
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Income vs savings</Text>
        <ProgressLine label="Expected harvest income" value={model.harvestIncome} max={model.harvestIncome || 1} />
        <ProgressLine label={`Savings target (${model.savingsPercent}%)`} value={model.savingsTarget} max={model.harvestIncome || 1} accent />
        <View style={styles.inlineStatRow}>
          <Text style={styles.inlineStatLabel}>Planned costs</Text>
          <Text style={styles.inlineStatValue}>{formatCurrency(model.plannedCosts)}</Text>
        </View>
      </View>

      {model.allocations.map((allocation) => (
        <AllocationCard key={allocation.key} allocation={allocation} />
      ))}

      <View style={styles.quoteCard}>
        <Ionicons name="bulb" size={18} color={P.goldDark} />
        <Text style={styles.quoteText}>{model.nudge}</Text>
      </View>

      {primaryAction ? <PrimaryActionButton action={primaryAction} /> : null}
    </View>
  );
}

export function InsuranceClaimsView({
  model,
  compact = false,
  primaryAction,
}: {
  model: InsuranceModel;
  compact?: boolean;
  primaryAction?: ResponseAction;
}) {
  const showLoading = model.loading && model.claims.length === 0;

  return (
    <View style={styles.stack}>
      {showLoading ? <LoadingCard compact={compact} /> : null}

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <IconTile icon="shield-checkmark" />
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Insurance coverage</Text>
            <Text style={styles.summaryText}>{model.intro}</Text>
          </View>
          <View style={styles.readinessBadge}>
            <Text style={styles.readinessValue}>{model.readinessScore}%</Text>
            <Text style={styles.readinessLabel}>ready</Text>
          </View>
        </View>
      </View>

      <View style={styles.coverageCard}>
        <View style={styles.coverageHeader}>
          <IconTile icon="umbrella" />
          <View style={{ flex: 1 }}>
            <Text style={styles.coverageTitle}>{model.coverageScheme}</Text>
            <Text style={styles.coverageMeta}>{model.premiumLabel}</Text>
          </View>
        </View>
        <View style={styles.coverageAmountRow}>
          <Text style={styles.coverageAmountLabel}>Estimated coverage</Text>
          <Text style={styles.coverageAmountValue}>{formatCurrency(model.coverageAmount)}</Text>
        </View>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Claim process</Text>
        {model.steps.map((step, index) => (
          <StepRow key={step.title} index={index + 1} step={step} />
        ))}
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Keep these ready</Text>
        <View style={styles.statusGrid}>
          {model.nextDocuments.slice(0, 4).map((doc) => (
            <View key={doc} style={styles.docChip}>
              <Text style={styles.docChipText}>{doc}</Text>
            </View>
          ))}
        </View>
      </View>

      {model.claims.map((claim) => (
        <ClaimCard key={claim.id} claim={claim} compact={compact} />
      ))}

      {primaryAction ? <PrimaryActionButton action={primaryAction} /> : null}
    </View>
  );
}

function LoadingCard({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.loadingCard, compact && styles.loadingCardCompact]}>
      <ActivityIndicator color={P.goldDark} />
      <Text style={styles.loadingText}>Preparing your economics summary...</Text>
    </View>
  );
}

function PrimaryActionButton({ action }: { action: ResponseAction }) {
  return (
    <Pressable style={styles.primaryButton} onPress={action.onPress}>
      <Text style={styles.primaryButtonText}>{action.label}</Text>
      <Ionicons name={action.icon} size={18} color={P.ink} />
    </Pressable>
  );
}

function IconTile({ icon }: { icon: IoniconName }) {
  return (
    <View style={styles.iconTile}>
      <Ionicons name={icon} size={20} color={P.ink} />
    </View>
  );
}

function MetricCard({
  icon,
  title,
  value,
  meta,
  compact,
}: {
  icon: IoniconName;
  title: string;
  value: string;
  meta: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact]}>
      <View style={styles.metricHeader}>
        <IconTile icon={icon} />
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricMeta}>{meta}</Text>
    </View>
  );
}

function StatusPill({ item }: { item: StatusItemModel }) {
  const colors = statusToneColor(item.tone);
  return (
    <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
      <Ionicons name={item.icon} size={15} color={colors.fg} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.statusPillLabel, { color: colors.fg }]}>{item.label}</Text>
        <Text style={[styles.statusPillValue, { color: colors.fg }]}>{item.value}</Text>
      </View>
    </View>
  );
}

function OfferCard({
  offer,
  compact,
  action,
}: {
  offer: OfferCardModel;
  compact?: boolean;
  action?: ResponseAction;
}) {
  return (
    <View style={[styles.offerCard, compact && styles.offerCardCompact]}>
      <View style={styles.offerHeader}>
        <IconTile icon={offer.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.offerTitle}>{offer.title}</Text>
          <Text style={styles.offerSubtitle}>{offer.subtitle}</Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>{offer.confidence}%</Text>
        </View>
      </View>

      <View style={styles.offerMetaGrid}>
        <View style={styles.offerMetaBox}>
          <Text style={styles.offerMetaLabel}>{offer.amountLabel}</Text>
          <Text style={styles.offerMetaValue}>{offer.amountValue}</Text>
        </View>
        <View style={styles.offerMetaBox}>
          <Text style={styles.offerMetaLabel}>{offer.rateLabel}</Text>
          <Text style={styles.offerMetaValue}>{offer.rateValue}</Text>
        </View>
      </View>

      <Pressable style={styles.secondaryButton} onPress={action?.onPress}>
        <Text style={styles.secondaryButtonText}>{offer.buttonLabel}</Text>
        <Ionicons name={(action?.icon ?? "volume-medium") as IoniconName} size={18} color={P.ink} />
      </Pressable>
    </View>
  );
}

function IncomeCard({ amount, compact }: { amount: number; compact?: boolean }) {
  const bars = [0.28, 0.52, 0.44, 0.7, 0.92];
  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact]}>
      <Text style={styles.featureHeading}>HARVEST INCOME</Text>
      <Text style={styles.featureAmount}>{formatCurrency(amount)}</Text>
      <View style={styles.barSparkline}>
        {bars.map((height, index) => (
          <View key={index} style={[styles.sparkBar, { height: 32 + height * 44, opacity: 0.46 + index * 0.12 }]} />
        ))}
      </View>
    </View>
  );
}

function ProfitCostCard({
  profitPercent,
  costPercent,
  compact,
}: {
  profitPercent: number;
  costPercent: number;
  compact?: boolean;
}) {
  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact]}>
      <Text style={styles.featureHeading}>PROFIT & COST</Text>
      <View style={styles.ringWrap}>
        <RatioRing primary={profitPercent} secondary={costPercent} />
      </View>
      <View style={styles.ringLegendRow}>
        <View style={styles.ringLegendItem}>
          <View style={[styles.legendDot, { backgroundColor: P.goldDark }]} />
          <Text style={styles.legendLabel}>Profit {profitPercent}%</Text>
        </View>
        <View style={styles.ringLegendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#E6D7B6" }]} />
          <Text style={styles.legendLabel}>Cost {costPercent}%</Text>
        </View>
      </View>
    </View>
  );
}

function RatioRing({ primary, secondary }: { primary: number; secondary: number }) {
  const size = 122;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const primaryLength = circumference * (primary / 100);
  const secondaryLength = circumference * (secondary / 100);

  return (
    <View style={styles.ratioRingShell}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F0E7D7"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#B6924B"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${primaryLength} ${circumference - primaryLength}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E6D7B6"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${secondaryLength} ${circumference - secondaryLength}`}
          strokeDashoffset={-primaryLength}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ratioRingCenter}>
        <Text style={styles.ratioRingValue}>{primary}%</Text>
        <Text style={styles.ratioRingLabel}>net margin</Text>
      </View>
    </View>
  );
}

function ProgressLine({
  label,
  value,
  max,
  accent = false,
}: {
  label: string;
  value: number;
  max: number;
  accent?: boolean;
}) {
  const width = (max > 0 ? `${clamp((value / max) * 100, 6, 100)}%` : "6%") as `${number}%`;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{formatCurrency(value)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, accent && styles.progressFillAccent, { width }]} />
      </View>
    </View>
  );
}

function AllocationCard({ allocation }: { allocation: AllocationModel }) {
  return (
    <View style={styles.allocationCard}>
      <View style={styles.allocationLeft}>
        <IconTile icon={allocation.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.allocationTitle}>{allocation.title}</Text>
          <Text style={styles.allocationSubtitle}>{allocation.subtitle}</Text>
        </View>
      </View>
      <Text style={styles.allocationAmount}>{formatCurrency(allocation.amount)}</Text>
    </View>
  );
}

function StepRow({ index, step }: { index: number; step: ClaimStepModel }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIndex}>
        <Text style={styles.stepIndexText}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepBody}>{step.body}</Text>
      </View>
    </View>
  );
}

function ClaimCard({ claim, compact }: { claim: ClaimCardModel; compact?: boolean }) {
  const status = claimStatusMeta(claim.status);
  return (
    <View style={[styles.claimCard, compact && styles.offerCardCompact]}>
      <View style={styles.claimHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.claimTitle}>{claim.title}</Text>
          <Text style={styles.claimDate}>{claim.dateLabel}</Text>
        </View>
        <View style={[styles.claimStatusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.claimStatusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <View style={styles.claimMetricRow}>
        <Text style={styles.claimMetricLabel}>Claimed</Text>
        <Text style={styles.claimMetricValue}>{formatCurrency(claim.claimedAmount)}</Text>
      </View>
      {claim.approvedAmount !== undefined ? (
        <View style={styles.claimMetricRow}>
          <Text style={styles.claimMetricLabel}>Approved</Text>
          <Text style={styles.claimMetricValue}>{formatCurrency(claim.approvedAmount)}</Text>
        </View>
      ) : null}
      <View style={styles.claimMetricRow}>
        <Text style={styles.claimMetricLabel}>Readiness</Text>
        <Text style={styles.claimMetricValue}>{claim.readinessScore}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 8,
  },
  heroButtonWrap: {
    marginTop: 6,
  },
  heroPressed: {
    opacity: 0.84,
  },
  heroOuterRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 4,
    borderColor: P.goldSoft,
    backgroundColor: "#FFF7E4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: P.goldShadow,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: P.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPrompt: {
    marginTop: 18,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "800",
    color: P.ink,
    textAlign: "center",
  },
  heroIntro: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: P.mutedDark,
    textAlign: "center",
    maxWidth: 320,
  },
  heroDotsLeft: {
    position: "absolute",
    left: 54,
    top: 62,
    flexDirection: "row",
    gap: 8,
  },
  heroDotsRight: {
    position: "absolute",
    right: 54,
    top: 62,
    flexDirection: "row",
    gap: 8,
  },
  heroDot: {
    width: 7,
    height: 18,
    borderRadius: 8,
    backgroundColor: P.goldSoft,
  },
  heroDotTall: {
    height: 24,
    backgroundColor: P.gold,
  },
  loadingCard: {
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingCardCompact: {
    borderRadius: 22,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "700",
    color: P.mutedDark,
  },
  summaryCard: {
    borderRadius: 30,
    padding: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    shadowColor: "#B8A36D",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  emptyCard: {
    borderRadius: 30,
    padding: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
  },
  summaryCardCompact: {
    padding: 16,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: P.ink,
  },
  summaryText: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: P.mutedDark,
  },
  summaryMeta: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "700",
    color: P.goldDark,
  },
  scoreBadge: {
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1C9",
  },
  scoreBadgeValue: {
    fontSize: 18,
    fontWeight: "900",
    color: P.ink,
  },
  readinessBadge: {
    minWidth: 70,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1C9",
  },
  readinessValue: {
    fontSize: 16,
    fontWeight: "900",
    color: P.ink,
  },
  readinessLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: P.mutedDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dualGrid: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 26,
    padding: 16,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
  },
  metricCardCompact: {
    borderRadius: 22,
    padding: 14,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: P.ink,
  },
  metricValue: {
    marginTop: 18,
    fontSize: 26,
    fontWeight: "900",
    color: P.ink,
  },
  metricMeta: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: P.mutedDark,
  },
  detailCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#F9F4E8",
    borderWidth: 1,
    borderColor: P.lineSoft,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: P.ink,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  statusGrid: {
    gap: 10,
  },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusPillLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statusPillValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "800",
  },
  offerCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: "#E2D0A4",
    shadowColor: P.goldShadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  offerCardCompact: {
    borderRadius: 24,
  },
  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  offerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: P.ink,
  },
  offerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: P.mutedDark,
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#FFF1C9",
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: "900",
    color: P.ink,
  },
  offerMetaGrid: {
    marginTop: 14,
    gap: 10,
  },
  offerMetaBox: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#F9F4E8",
  },
  offerMetaLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: P.mutedDark,
  },
  offerMetaValue: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: P.ink,
  },
  secondaryButton: {
    marginTop: 14,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#EFD27A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: P.ink,
  },
  primaryButton: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: "#EFD27A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: P.ink,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F2D9A4",
    alignItems: "center",
    justifyContent: "center",
  },
  featureHeading: {
    fontSize: 15,
    fontWeight: "900",
    color: P.ink,
  },
  featureAmount: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: "900",
    color: P.ink,
  },
  barSparkline: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 18,
    height: 86,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: P.goldDark,
  },
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  ratioRingShell: {
    width: 122,
    height: 122,
    alignItems: "center",
    justifyContent: "center",
  },
  ratioRingCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ratioRingValue: {
    fontSize: 24,
    fontWeight: "900",
    color: P.ink,
  },
  ratioRingLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: P.mutedDark,
  },
  ringLegendRow: {
    marginTop: 10,
    gap: 8,
  },
  ringLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: P.mutedDark,
  },
  progressWrap: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: P.ink,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: "900",
    color: P.ink,
  },
  progressTrack: {
    height: 18,
    borderRadius: 999,
    backgroundColor: "#EEE6D7",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#D79845",
  },
  progressFillAccent: {
    backgroundColor: P.goldDark,
  },
  inlineStatRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inlineStatLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: P.mutedDark,
  },
  inlineStatValue: {
    fontSize: 13,
    fontWeight: "900",
    color: P.ink,
  },
  allocationCard: {
    borderRadius: 26,
    padding: 16,
    backgroundColor: "#FBF7EE",
    borderWidth: 1,
    borderColor: P.lineSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  allocationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  allocationTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: P.ink,
  },
  allocationSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: P.mutedDark,
  },
  allocationAmount: {
    fontSize: 18,
    fontWeight: "900",
    color: P.ink,
  },
  quoteCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "#F4EEDB",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  quoteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: P.ink,
    fontStyle: "italic",
  },
  coverageCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#F9F4E8",
    borderWidth: 1,
    borderColor: P.lineSoft,
  },
  coverageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coverageTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: P.ink,
  },
  coverageMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: P.mutedDark,
  },
  coverageAmountRow: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: P.line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverageAmountLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: P.mutedDark,
  },
  coverageAmountValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#D98827",
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFE8A8",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexText: {
    fontSize: 13,
    fontWeight: "900",
    color: P.ink,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: P.ink,
  },
  stepBody: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: P.mutedDark,
  },
  docChip: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFF7E4",
  },
  docChipText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: P.ink,
  },
  claimCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
  },
  claimHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  claimTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: P.ink,
  },
  claimDate: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: P.mutedDark,
  },
  claimStatusBadge: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  claimStatusText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  claimMetricRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  claimMetricLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: P.mutedDark,
  },
  claimMetricValue: {
    fontSize: 14,
    fontWeight: "900",
    color: P.ink,
  },
});

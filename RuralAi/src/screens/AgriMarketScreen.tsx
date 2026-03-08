/**
 * AgriMarket Screen — pixel-perfect match to warm/earthy design mockups.
 * Crops tab: India SVG map + Live Mandi Prices + Collect to Bargain CTA.
 * Historical tab: Date-range picker + bar/line chart + price history cards + Analyze Data CTA.
 *
 * ★ FULLY DYNAMIC — supports 25+ crops, driven by:
 *   1. route.params (from voice navigation or deep links)
 *   2. useVoice() context (reacts to voice commands in real-time)
 *   3. useScreenContext() (reports current view to voice agent)
 *   4. User tap (crop selector pills)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
  TextInput,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import Svg, {
  Path,
  Circle,
  Rect,
  Line,
  Text as SvgText,
  G,
  Polyline,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import {
  useMarketPrices,
  useMandis,
  useHealthCheck,
  usePriceTrend,
  useBargainingGroups,
} from "../hooks/useData";
import { useVoice } from "../voice/VoiceContext";
import { useScreenContext } from "../context/ScreenContext";
import type { HomeStackParamList } from "../navigation/HomeStack";
import { normalizeMarketCropName, normalizeMarketStateName } from "../utils/market";
import India from "@svg-maps/india";

const { width: SCREEN_W } = Dimensions.get("window");

/* ═══════════ DESIGN THEME — warm / earthy / golden ═══════════ */
const T = {
  bg: "#F5ECD7",
  card: "#FFFDF6",
  cardBorder: "#E8DFC8",
  gold: "#C9A96E",
  goldDark: "#A8873F",
  goldLight: "#EDE0C0",
  goldTint: "rgba(201,169,110,0.15)",
  ink: "#3B2F1E",
  sub: "#7A6C5B",
  muted: "#A39782",
  green: "#2ECC71",
  greenDark: "#1FA85A",
  greenLight: "#D4EDDA",
  red: "#E74C3C",
  white: "#FFFFFF",
  cream: "#FBF5E8",
  mapBg: "#EDE8D8",
  mapState: "#D4C9A8",
  divider: "#DED5BC",
};

/* ═══════════ MONTHS HELPER ═══════════ */
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LABEL = ["J", "F", "M", "A", "Ma", "Jn", "J", "Ag", "Sp", "O", "No", "D"];

/* ═══════════ India Map SVG (via @svg-maps/india) ═══════════ */
const STATE_FILL: Record<string, string> = {
  rj: "#F0D8A0", mp: "#C8C8D8", up: "#A8D8A0", mh: "#D8A8B8",
  gj: "#D8B8A8", ka: "#D8C8D8", ap: "#B8C8D8", tg: "#B8C8D8",
  tn: "#D8B8C8", wb: "#B8D8D8", br: "#D8C8A8", or: "#C8D8B8",
  pb: "#D8D8C8", hr: "#E8D8B8", ct: "#A8C8B8", jh: "#D8D8A8",
  kl: "#A8D8C8", ga: "#E8C8D8", jk: "#E8C8C8", hp: "#C8D8C8",
  uk: "#C8E8C8", dl: "#E8D8B8", as: "#B8D8A8", sk: "#E8D8C8",
  ml: "#C8E8D8", mn: "#D8E8C8", mz: "#C8D8E8", nl: "#D8C8E8",
  tr: "#E8C8E8", ar: "#C8E8E8",
};

function IndiaMapSvg({ width = SCREEN_W - 48, height = 280 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox={India.viewBox}>
      {India.locations.map((loc: any) => (
        <Path
          key={loc.id}
          d={loc.path}
          fill={STATE_FILL[loc.id] || T.mapState}
          stroke={T.cardBorder}
          strokeWidth={0.5}
          opacity={0.92}
        />
      ))}
    </Svg>
  );
}

/* ═══════════ Mini Sparkline (for Crops tab price cards) ═══════════ */
function Sparkline({ data, color, width = 70, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - 3 - ((v - min) / range) * (height - 6)}`).join(" ");
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ═══════════ Bar + Line combo chart (Historical tab) ═══════════ */
function BarLineChart({
  primaryData,
  compareData,
  primaryColor = T.gold,
  compareColor = T.green,
  months,
}: {
  primaryData: number[];
  compareData?: number[];
  primaryColor?: string;
  compareColor?: string;
  months: string[];
}) {
  const chartW = SCREEN_W - 80;
  const chartH = 180;
  const padL = 35;
  const padR = 10;
  const padT = 10;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const allVals = [...primaryData, ...(compareData ?? [])].filter(v => v > 0);
  const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.1 : 2000;
  const barGroupW = plotW / Math.max(months.length, 1);
  const barW = compareData ? barGroupW * 0.3 : barGroupW * 0.45;

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  const toY = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const primaryLinePoints = primaryData
    .map((v, i) => `${padL + i * barGroupW + barGroupW / 2},${toY(v)}`)
    .join(" ");
  const compareLinePoints = compareData
    ?.map((v, i) => `${padL + i * barGroupW + barGroupW / 2},${toY(v)}`)
    ?.join(" ") ?? "";

  return (
    <Svg width={chartW} height={chartH}>
      <Defs>
        <LinearGradient id="primaryBar" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={primaryColor} />
          <Stop offset="1" stopColor={primaryColor} stopOpacity={0.6} />
        </LinearGradient>
        <LinearGradient id="compareBar" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={compareColor} />
          <Stop offset="1" stopColor={compareColor} stopOpacity={0.6} />
        </LinearGradient>
      </Defs>

      {/* Y grid lines */}
      {yTicks.map((tick, i) => (
        <G key={`y${i}`}>
          <Line x1={padL} y1={toY(tick)} x2={padL + plotW} y2={toY(tick)}
            stroke={T.divider} strokeWidth={0.5} strokeDasharray="3,3" />
          <SvgText x={padL - 4} y={toY(tick) + 3} fontSize={8} fill={T.muted} textAnchor="end">
            {Math.round(tick)}
          </SvgText>
        </G>
      ))}

      {/* Bars */}
      {months.map((_, i) => {
        const x = padL + i * barGroupW + barGroupW / 2;
        const pH = (primaryData[i] || 0) / maxVal * plotH;
        return (
          <G key={`bar${i}`}>
            <Rect x={compareData ? x - barW - 1 : x - barW / 2} y={toY(primaryData[i] || 0)} width={barW}
              height={pH} rx={2} fill="url(#primaryBar)" opacity={0.85} />
            {compareData && (
              <Rect x={x + 1} y={toY(compareData[i] || 0)} width={barW}
                height={(compareData[i] || 0) / maxVal * plotH} rx={2} fill="url(#compareBar)" opacity={0.85} />
            )}
          </G>
        );
      })}

      {/* Lines */}
      {primaryData.length > 1 && (
        <Polyline points={primaryLinePoints} fill="none" stroke={primaryColor} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />
      )}
      {compareData && compareData.length > 1 && (
        <Polyline points={compareLinePoints} fill="none" stroke={compareColor} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Dots on lines */}
      {primaryData.map((v, i) => (
        <Circle key={`pd${i}`} cx={padL + i * barGroupW + barGroupW / 2} cy={toY(v)} r={3}
          fill={primaryColor} stroke={T.white} strokeWidth={1.5} />
      ))}
      {compareData?.map((v, i) => (
        <Circle key={`cd${i}`} cx={padL + i * barGroupW + barGroupW / 2} cy={toY(v)} r={3}
          fill={compareColor} stroke={T.white} strokeWidth={1.5} />
      ))}

      {/* X labels */}
      {months.map((m, i) => (
        <SvgText key={`xl${i}`} x={padL + i * barGroupW + barGroupW / 2} y={chartH - 5}
          fontSize={8} fill={T.muted} textAnchor="middle">{m}</SvgText>
      ))}
    </Svg>
  );
}

/* ═══════════ CROP REGISTRY — all supported crops with emoji + colors ═══════════ */
const CROP_REGISTRY: Record<string, { emoji: string; bg: string; color: string }> = {
  wheat:      { emoji: "🌾", bg: "#FEF3C7", color: "#C9A96E" },
  rice:       { emoji: "🌾", bg: "#ECFDF5", color: "#2ECC71" },
  tomato:     { emoji: "🍅", bg: "#FEE2E2", color: "#E74C3C" },
  onion:      { emoji: "🧅", bg: "#FEF3C7", color: "#D97706" },
  potato:     { emoji: "🥔", bg: "#FEF9C3", color: "#A16207" },
  brinjal:    { emoji: "🍆", bg: "#F3E8FF", color: "#7C3AED" },
  soybean:    { emoji: "🫘", bg: "#ECFDF5", color: "#15803D" },
  cotton:     { emoji: "☁️", bg: "#EFF6FF", color: "#3B82F6" },
  sugarcane:  { emoji: "🎋", bg: "#F0FDF4", color: "#16A34A" },
  mustard:    { emoji: "🌼", bg: "#FFFBEB", color: "#CA8A04" },
  chana:      { emoji: "🫘", bg: "#FEF3C7", color: "#B45309" },
  maize:      { emoji: "🌽", bg: "#FFFBEB", color: "#EAB308" },
  sunflower:  { emoji: "🌻", bg: "#FFFBEB", color: "#F59E0B" },
  groundnut:  { emoji: "🥜", bg: "#FEF3C7", color: "#92400E" },
  turmeric:   { emoji: "🟡", bg: "#FFFBEB", color: "#D97706" },
  cumin:      { emoji: "🌿", bg: "#F0FDF4", color: "#166534" },
  jowar:      { emoji: "🌾", bg: "#FEF9C3", color: "#A16207" },
  bajra:      { emoji: "🌾", bg: "#F5F5DC", color: "#78716C" },
  arhar:      { emoji: "🫘", bg: "#FEF3C7", color: "#B45309" },
  urad:       { emoji: "🫘", bg: "#1C1917", color: "#FAFAF9" },
  moong:      { emoji: "🫘", bg: "#DCFCE7", color: "#15803D" },
  barley:     { emoji: "🌾", bg: "#FEF3C7", color: "#A8873F" },
  copra:      { emoji: "🥥", bg: "#F5F5DC", color: "#78716C" },
  pepper:     { emoji: "🌶️", bg: "#FEE2E2", color: "#B91C1C" },
  cardamom:   { emoji: "🌿", bg: "#F0FDF4", color: "#166534" },
  jute:       { emoji: "🧵", bg: "#FEF9C3", color: "#92400E" },
  okra:       { emoji: "🥬", bg: "#ECFCCB", color: "#65A30D" },
};

const ALL_CROPS = Object.keys(CROP_REGISTRY);
const DEFAULT_VISIBLE_CROPS = ["wheat", "rice", "tomato", "onion", "potato", "brinjal"];
const HISTORY_WINDOW_DAYS = 365;
const HISTORY_ROW_LIMIT = 240;

/* ═══════════ MAIN SCREEN ═══════════ */
export default function AgriMarketScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<HomeStackParamList, "AgriMarket">>();
  const voice = useVoice();
  const screen = useScreenContext();

  /* ── Route params (from voice navigation or deep links) ── */
  const paramCrop = normalizeMarketCropName(route.params?.crop);
  const paramTab = route.params?.tab;
  const paramCompareCrop = route.params?.compareCrop ? normalizeMarketCropName(route.params.compareCrop) : undefined;
  const paramLocation = normalizeMarketStateName(route.params?.location);

  const [activeTab, setActiveTab] = useState<"crops" | "historical">(paramTab || "crops");
  const [primaryCrop, setPrimaryCrop] = useState<string>(paramCrop || "wheat");
  const [compareCrop, setCompareCrop] = useState<string | null>(paramCompareCrop || null);
  const [locationFilter, setLocationFilter] = useState<string | undefined>(paramLocation);
  const [cropSearch, setCropSearch] = useState("");
  const [showAllCrops, setShowAllCrops] = useState(false);

  /* ── API hooks (DYNAMIC — driven by primaryCrop & compareCrop state) ── */
  const health = useHealthCheck();
  const primaryPrices = useMarketPrices(primaryCrop, locationFilter);
  const comparePrices = useMarketPrices(compareCrop || "", locationFilter);
  const primaryFallbackPrices = useMarketPrices(locationFilter ? primaryCrop : "");
  const compareFallbackPrices = useMarketPrices(locationFilter && compareCrop ? compareCrop : "");
  const primaryHistoryPrices = useMarketPrices(primaryCrop, locationFilter, undefined, HISTORY_WINDOW_DAYS, HISTORY_ROW_LIMIT);
  const primaryFallbackHistoryPrices = useMarketPrices(locationFilter ? primaryCrop : "", undefined, undefined, HISTORY_WINDOW_DAYS, HISTORY_ROW_LIMIT);
  const mandis = useMandis();
  const primaryTrendData = usePriceTrend(primaryCrop, undefined, 365, locationFilter);
  const compareTrendData = usePriceTrend(compareCrop || "", undefined, 365, locationFilter);
  const primaryFallbackTrendData = usePriceTrend(locationFilter ? primaryCrop : "", undefined, 365);
  const compareFallbackTrendData = usePriceTrend(locationFilter && compareCrop ? compareCrop : "", undefined, 365);
  const bargaining = useBargainingGroups();

  const isOnline = health.data?.status === "ok";
  const primaryHasRows = (primaryPrices.data?.prices?.length ?? 0) > 0;
  const compareHasRows = (comparePrices.data?.prices?.length ?? 0) > 0;
  const primaryHistoryHasRows = (primaryHistoryPrices.data?.prices?.length ?? 0) > 0;
  const usePrimaryFallback = !!locationFilter && !primaryHasRows && (primaryFallbackPrices.data?.prices?.length ?? 0) > 0;
  const useCompareFallback = !!locationFilter && !!compareCrop && !compareHasRows && (compareFallbackPrices.data?.prices?.length ?? 0) > 0;
  const usePrimaryHistoryFallback =
    !!locationFilter &&
    !primaryHistoryHasRows &&
    (primaryFallbackHistoryPrices.data?.prices?.length ?? 0) > 0;
  const resolvedPrimaryPrices = usePrimaryFallback ? primaryFallbackPrices : primaryPrices;
  const resolvedComparePrices = useCompareFallback ? compareFallbackPrices : comparePrices;
  const resolvedPrimaryHistoryPrices = usePrimaryHistoryFallback ? primaryFallbackHistoryPrices : primaryHistoryPrices;
  const isLoading = primaryPrices.loading || (!!locationFilter && !primaryHasRows && primaryFallbackPrices.loading);

  /* ── Crop info helper ── */
  const cropInfo = (c: string) => CROP_REGISTRY[c] || { emoji: "🌿", bg: "#F0FDF4", color: "#16A34A" };
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const showLiveStateFallback = usePrimaryFallback || useCompareFallback;

  /* ─────────────────────────────────────────────────────── */
  /*  VOICE ↔ SCREEN SYNC                                   */
  /* ─────────────────────────────────────────────────────── */

  /* Listen to incoming voice commands and react */
  const lastCommandRef = useRef(voice.lastCommand);
  useEffect(() => {
    if (!voice.lastCommand || voice.lastCommand === lastCommandRef.current) return;
    lastCommandRef.current = voice.lastCommand;

    const cmd = voice.lastCommand;
    const entities = cmd.entities || {};

    // If voice mentions a crop, switch to it
    if (entities.crop) {
      const voiceCrop = normalizeMarketCropName(entities.crop);
      if (voiceCrop) {
        setPrimaryCrop(voiceCrop);
      }
    }

    // If voice says "compare with rice", set compareCrop
    if (entities.compareCrop || entities.compare_crop) {
      const vc = normalizeMarketCropName(entities.compareCrop ?? entities.compare_crop);
      if (vc && vc !== primaryCrop) {
        setCompareCrop(vc);
      }
    }

    if (entities.location) {
      const stateName = normalizeMarketStateName(entities.location);
      setLocationFilter(stateName);
    }

    // Tab switching from voice
    const intentLower = (cmd.intent || "").toLowerCase();
    if (intentLower.includes("trend") || intentLower.includes("history") || intentLower.includes("historical")) {
      setActiveTab("historical");
    } else if (intentLower.includes("price") || intentLower.includes("crop") || intentLower.includes("mandi")) {
      setActiveTab("crops");
    }
  }, [voice.lastCommand, primaryCrop]);

  /* Also react to route.params changes (when voice navigates again to same screen) */
  useEffect(() => {
    if (paramCrop) setPrimaryCrop(paramCrop);
    if (paramTab) setActiveTab(paramTab);
    if (paramCompareCrop) setCompareCrop(paramCompareCrop);
    setLocationFilter(paramLocation);
  }, [paramCrop, paramTab, paramCompareCrop, paramLocation]);

  /* ── Parse prices ── */
  const primaryPrice = resolvedPrimaryPrices.data?.summary?.average_price
    ?? (resolvedPrimaryPrices.data as any)?.summary?.avgPrice ?? 0;
  const comparePrice = resolvedComparePrices.data?.summary?.average_price
    ?? (resolvedComparePrices.data as any)?.summary?.avgPrice ?? 0;
  const bargainCount = ((bargaining.data as any)?.groups ?? []).length;

  /* ── Parse trend data for sparklines ── */
  const getTrendPoints = (trendRaw: any) => trendRaw?.data?.data_points ?? trendRaw?.data?.trend ?? trendRaw?.data?.prices ?? [];
  const parseTrend = (trendRaw: any): { prices: number[]; dates: string[] } => {
    const pts = getTrendPoints(trendRaw);
    if (Array.isArray(pts) && pts.length > 0) {
      return {
        prices: pts.map((p: any) =>
          typeof p === "number" ? p : parseFloat(p.avg_modal ?? p.price ?? p.modal_price ?? p.price_per_quintal ?? 0)
        ),
        dates: pts.map((p: any) => p.trade_date ?? p.date ?? ""),
      };
    }
    return { prices: [], dates: [] };
  };

  const usePrimaryTrendFallback =
    !!locationFilter && getTrendPoints(primaryTrendData).length === 0 && getTrendPoints(primaryFallbackTrendData).length > 0;
  const useCompareTrendFallback =
    !!locationFilter && !!compareCrop && getTrendPoints(compareTrendData).length === 0 && getTrendPoints(compareFallbackTrendData).length > 0;
  const resolvedPrimaryTrendData = usePrimaryTrendFallback ? primaryFallbackTrendData : primaryTrendData;
  const resolvedCompareTrendData = useCompareTrendFallback ? compareFallbackTrendData : compareTrendData;
  const showHistoryStateFallback = usePrimaryHistoryFallback || usePrimaryTrendFallback;
  const showStateFallback = activeTab === "historical" ? showHistoryStateFallback : showLiveStateFallback;

  const primaryTrendParsed = parseTrend(resolvedPrimaryTrendData);
  const compareTrendParsed = compareCrop ? parseTrend(resolvedCompareTrendData) : null;

  const primarySparkline = primaryTrendParsed.prices.length > 0 ? primaryTrendParsed.prices.slice(-7) : [];
  const compareSparkline = compareTrendParsed && compareTrendParsed.prices.length > 0 ? compareTrendParsed.prices.slice(-7) : [];

  const calcDelta = (arr: number[]) => {
    if (arr.length < 2) return 0;
    return ((arr[arr.length - 1] - arr[0]) / (arr[0] || 1)) * 100;
  };
  const primaryDelta = calcDelta(primarySparkline);
  const compareDelta = compareSparkline ? calcDelta(compareSparkline) : 0;
  const primaryLabel = capitalize(primaryCrop);
  const compareLabel = compareCrop ? capitalize(compareCrop) : "";

  /* ── Filtered crops for selector ── */
  const filteredCrops = useMemo(() => {
    const query = cropSearch.toLowerCase().trim();
    const list = query ? ALL_CROPS.filter(c => c.includes(query)) : (showAllCrops ? ALL_CROPS : DEFAULT_VISIBLE_CROPS);
    return list;
  }, [cropSearch, showAllCrops]);

  /* ── Historical chart data: aggregate by month ── */
  const chartData = useMemo(() => {
    const aggregate = (parsed: { prices: number[]; dates: string[] }) => {
      const byMonth: Record<string, number[]> = {};
      parsed.dates.forEach((d, i) => {
        if (!d) return;
        const dt = new Date(d);
        const key = `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, "0")}`;
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(parsed.prices[i]);
      });
      const sortedKeys = Object.keys(byMonth).sort();
      return {
        months: sortedKeys.map(k => {
          const [, m] = k.split("-");
          return MONTH_LABEL[parseInt(m, 10)] ?? m;
        }),
        avgPrices: sortedKeys.map(k => {
          const vals = byMonth[k];
          return vals.reduce((a, b) => a + b, 0) / vals.length;
        }),
      };
    };
    const primary = aggregate(primaryTrendParsed);
    const compare = compareTrendParsed ? aggregate(compareTrendParsed) : null;
    const allMonths = compare
      ? [...new Set([...primary.months, ...compare.months])].slice(-12)
      : primary.months.slice(-12);
    const pMap = new Map(primary.months.map((m, i) => [m, primary.avgPrices[i]]));
    const cMap = compare ? new Map(compare.months.map((m, i) => [m, compare.avgPrices[i]])) : null;
    return {
      months: allMonths,
      primary: allMonths.map(m => pMap.get(m) ?? 0),
      compare: cMap ? allMonths.map(m => cMap.get(m) ?? 0) : undefined,
    };
  }, [primaryTrendParsed, compareTrendParsed]);

  /* ── Historical price entries (distinct, primary crop only) ── */
  const historyEntries = useMemo(() => {
    const prices = resolvedPrimaryHistoryPrices.data?.prices ?? (resolvedPrimaryHistoryPrices.data as any)?.prices ?? [];
    const format = (d: string) => {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? d : `${MONTH_SHORT[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
    };
    const seen = new Set<string>();
    const entries: { date: string; rawDate: string; mandi: string; state: string; price: number; delta: number }[] = [];
    (prices as any[]).forEach((p: any, i: number) => {
      const date = p.trade_date ?? p.date ?? "";
      const mandi = p.mandi_name ?? p.mandi ?? "";
      const state = p.state ?? "";
      const key = `${date}|${mandi}|${p.modal_price ?? p.price_per_quintal}`;
      if (seen.has(key)) return;
      seen.add(key);
      const price = parseFloat(p.modal_price ?? p.price_per_quintal ?? 0);
      const prev = (prices as any[])[i + 1];
      const prevPrice = prev ? parseFloat(prev.modal_price ?? prev.price_per_quintal ?? 0) : price;
      const delta = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
      entries.push({ date: format(date), rawDate: date, mandi, state, price, delta });
    });
    return entries;
  }, [resolvedPrimaryHistoryPrices.data]);

  /* ── Date range for Historical header ── */
  const dateRange = useMemo(() => {
    const allDates = primaryTrendParsed.dates.filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d.getTime()));
    if (allDates.length === 0) return { start: "N/A", end: "N/A" };
    allDates.sort((a, b) => a.getTime() - b.getTime());
    const fmt = (d: Date) => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return { start: fmt(allDates[0]), end: fmt(allDates[allDates.length - 1]) };
  }, [primaryTrendParsed.dates]);

  const historyDates = useMemo(
    () => Array.from(new Set(primaryTrendParsed.dates.filter(Boolean))).sort(),
    [primaryTrendParsed.dates]
  );

  const historyCoverageSummary = useMemo(() => {
    if (historyDates.length === 0) {
      return {
        days: 0,
        summary: `No stored history available for ${primaryLabel}${locationFilter ? ` in ${locationFilter}` : ""}.`,
      };
    }

    const scopeLabel =
      showHistoryStateFallback && locationFilter
        ? `all-India fallback because ${locationFilter} has no stored rows yet`
        : (locationFilter || "all India");
    const dayLabel = historyDates.length === 1 ? "day" : "days";
    return {
      days: historyDates.length,
      summary: `Showing ${historyDates.length} stored ${dayLabel} for ${primaryLabel} in ${scopeLabel}. Coverage: ${historyDates[0]} to ${historyDates[historyDates.length - 1]}.`,
    };
  }, [historyDates, locationFilter, primaryLabel, showHistoryStateFallback]);

  const historyDatePreview = useMemo(() => {
    if (historyDates.length === 0) return "None";
    if (historyDates.length <= 6) return historyDates.join(", ");
    return `${historyDates.slice(0, 3).join(", ")} ... ${historyDates.slice(-3).join(", ")}`;
  }, [historyDates]);

  /* Report screen state to ScreenContext whenever key state changes */
  useEffect(() => {
    screen.update({
      screen: "AgriMarket",
      tab: activeTab,
      crop: primaryCrop,
      compareCrop: compareCrop || undefined,
      location: locationFilter || undefined,
      meta: {
        availableCrops: ALL_CROPS.join(", "),
        priceLoaded: !resolvedPrimaryPrices.loading,
        historyLoaded: !resolvedPrimaryHistoryPrices.loading,
        locationFilter: locationFilter || "All India",
        visibleScope: showStateFallback && locationFilter ? `Fallback to All India for ${locationFilter}` : (locationFilter || "All India"),
        historicalDaysAvailable: historyDates.length,
        historicalCoverageStart: historyDates[0] || "None",
        historicalCoverageEnd: historyDates[historyDates.length - 1] || "None",
        historicalVisibleDates: historyDatePreview,
      },
    });
  }, [
    activeTab,
    compareCrop,
    historyDatePreview,
    historyDates,
    locationFilter,
    primaryCrop,
    resolvedPrimaryHistoryPrices.loading,
    resolvedPrimaryPrices.loading,
    screen.update,
    showStateFallback,
  ]);

  /* crop selector handler */
  const selectCrop = useCallback((crop: string) => {
    setPrimaryCrop(crop);
    setCompareCrop(null);
    setCropSearch("");
  }, []);

  /* ═══════════ RENDER ═══════════ */
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </Pressable>
        <Text style={s.headerTitle}>Agriculture & Market</Text>
        <View style={[s.onlineDot, { backgroundColor: isOnline ? T.green : T.red }]} />
      </View>

      {/* ── Tab Toggle ── */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tab, activeTab === "crops" && s.tabActive]}
          onPress={() => setActiveTab("crops")}
        >
          <Text style={[s.tabText, activeTab === "crops" && s.tabTextActive]}>Crops</Text>
        </Pressable>
        <Pressable
          style={[s.tab, activeTab === "historical" && s.tabActive]}
          onPress={() => setActiveTab("historical")}
        >
          <Text style={[s.tabText, activeTab === "historical" && s.tabTextActive]}>Historical</Text>
        </Pressable>
      </View>

      {isLoading && (
        <View style={s.loaderWrap}>
          <ActivityIndicator size="large" color={T.gold} />
          <Text style={s.loaderText}>Fetching live prices for {primaryLabel}…</Text>
        </View>
      )}

      {/* ═══════ CROPS TAB ═══════ */}
      {activeTab === "crops" && !isLoading && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* India Map */}
          <View style={s.mapCard}>
            <IndiaMapSvg />
          </View>

          {/* Map Legend */}
          <View style={s.legendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: T.green }]} />
              <Text style={s.legendLabel}>Verified</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#5B9BD5" }]} />
              <Text style={s.legendLabel}>High volume</Text>
            </View>
          </View>

          {/* Drag handle */}
          <View style={s.handleWrap}>
            <View style={s.handle} />
          </View>

          {/* ── Crop Selector ── */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Select Crop</Text>
            <Pressable onPress={() => setShowAllCrops(!showAllCrops)}>
              <Text style={s.viewAll}>{showAllCrops ? "Show less" : `All ${ALL_CROPS.length} crops`}</Text>
            </Pressable>
          </View>

          {/* Search input */}
          <View style={s.searchRow}>
            <Ionicons name="search" size={16} color={T.muted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search crop…"
              placeholderTextColor={T.muted}
              value={cropSearch}
              onChangeText={setCropSearch}
              autoCorrect={false}
            />
            {cropSearch ? (
              <Pressable onPress={() => setCropSearch("")}>
                <Ionicons name="close-circle" size={16} color={T.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Crop pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.cropPillScroll} contentContainerStyle={s.cropPillContainer}>
            {filteredCrops.map(crop => {
              const info = cropInfo(crop);
              const active = crop === primaryCrop;
              return (
                <Pressable
                  key={crop}
                  style={[s.cropPill, active && { backgroundColor: info.color, borderColor: info.color }]}
                  onPress={() => selectCrop(crop)}
                >
                  <Text style={s.cropPillEmoji}>{info.emoji}</Text>
                  <Text style={[s.cropPillText, active && { color: T.white }]}>{capitalize(crop)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Live Mandi Prices header */}
          <View style={[s.sectionHeader, { marginTop: 14 }]}>
            <Text style={s.sectionTitle}>Live Mandi Prices</Text>
            <Pressable onPress={() => nav.navigate("MarketPrices", { crop: primaryCrop, location: locationFilter })}>
              <Text style={s.viewAll}>View all</Text>
            </Pressable>
          </View>

          {showLiveStateFallback && locationFilter ? (
            <View style={s.infoBanner}>
              <Ionicons name="information-circle-outline" size={16} color={T.goldDark} />
              <Text style={s.infoBannerText}>
                No live rows for {locationFilter}. Showing the latest {primaryLabel} data available from other states.
              </Text>
            </View>
          ) : null}

          {/* Price cards row — dynamic primary + optional compare */}
          <View style={s.priceRow}>
            {/* Primary crop card */}
            <View style={s.priceCard}>
              <View style={s.priceCardTop}>
                <View style={[s.cropIcon, { backgroundColor: cropInfo(primaryCrop).bg }]}>
                  <Text style={s.cropEmoji}>{cropInfo(primaryCrop).emoji}</Text>
                </View>
                <View style={s.priceInfo}>
                  <Text style={s.cropLabel}>{primaryLabel}</Text>
                  <Text style={s.priceVal}>₹{primaryPrice > 0 ? Math.round(primaryPrice) : "—"}/q</Text>
                  <Text style={[s.priceDelta, { color: primaryDelta >= 0 ? T.green : T.red }]}>
                    {primaryDelta >= 0 ? "+" : ""}{primaryDelta.toFixed(1)}%
                  </Text>
                </View>
              </View>
              <View style={s.sparkWrap}>
                <Sparkline data={primarySparkline} color={cropInfo(primaryCrop).color} />
              </View>
            </View>

            {/* Compare crop card (shown if compareCrop set) OR second popular crop */}
            {compareCrop ? (
              <View style={s.priceCard}>
                <View style={s.priceCardTop}>
                  <View style={[s.cropIcon, { backgroundColor: cropInfo(compareCrop).bg }]}>
                    <Text style={s.cropEmoji}>{cropInfo(compareCrop).emoji}</Text>
                  </View>
                  <View style={s.priceInfo}>
                    <Text style={s.cropLabel}>{compareLabel}</Text>
                    <Text style={s.priceVal}>₹{comparePrice > 0 ? Math.round(comparePrice) : "—"}/q</Text>
                    <Text style={[s.priceDelta, { color: compareDelta >= 0 ? T.green : T.red }]}>
                      {compareDelta >= 0 ? "+" : ""}{compareDelta.toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <View style={s.sparkWrap}>
                  <Sparkline data={compareSparkline || []} color={cropInfo(compareCrop).color} />
                </View>
              </View>
            ) : (
              <Pressable
                style={[s.priceCard, { justifyContent: "center", alignItems: "center", borderStyle: "dashed" }]}
                onPress={() => {
                  const other = ALL_CROPS.find(c => c !== primaryCrop) || "rice";
                  setCompareCrop(other);
                }}
              >
                <Ionicons name="add-circle-outline" size={28} color={T.gold} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: T.gold, marginTop: 6 }}>Compare crop</Text>
              </Pressable>
            )}
          </View>

          {/* Collect to Bargain CTA */}
          <Pressable style={s.ctaBtn} onPress={() => nav.navigate("BargainingGroups")}>
            <Ionicons name="people" size={18} color={T.white} />
            <Text style={s.ctaBtnText}>
              Collect to Bargain{bargainCount > 0 ? ` (${bargainCount})` : ""}
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ═══════ HISTORICAL TAB ═══════ */}
      {activeTab === "historical" && !isLoading && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Primary crop label */}
          <Text style={s.historyCropTitle}>{primaryLabel} Price History</Text>

          {/* Date range display */}
          <View style={s.dateRangeRow}>
            <Text style={s.dateRangeLabel}>{dateRange.start}</Text>
            <Ionicons name="arrow-forward" size={14} color={T.muted} />
            <Text style={s.dateRangeLabel}>{dateRange.end}</Text>
          </View>

          <View style={s.infoBanner}>
            <Ionicons name="calendar-outline" size={16} color={T.goldDark} />
            <Text style={s.infoBannerText}>{historyCoverageSummary.summary}</Text>
          </View>

          {/* Legend */}
          <View style={s.chartLegendRow}>
            <View style={s.chartLegendItem}>
              <View style={[s.chartLegendDot, { backgroundColor: cropInfo(primaryCrop).color }]} />
              <Text style={s.chartLegendLabel}>{primaryLabel}</Text>
            </View>
            {compareCrop && (
              <View style={s.chartLegendItem}>
                <View style={[s.chartLegendDot, { backgroundColor: cropInfo(compareCrop).color }]} />
                <Text style={s.chartLegendLabel}>{compareLabel}</Text>
              </View>
            )}
          </View>

          {/* Chart */}
          <View style={s.chartCard}>
            {chartData.months.length > 0 ? (
              <BarLineChart
                primaryData={chartData.primary}
                compareData={chartData.compare}
                primaryColor={cropInfo(primaryCrop).color}
                compareColor={compareCrop ? cropInfo(compareCrop).color : T.green}
                months={chartData.months}
              />
            ) : (
              <View style={s.noDataWrap}>
                <Text style={s.noDataText}>No historical data available for {primaryLabel}</Text>
              </View>
            )}
          </View>

          {/* Compare button — pick any crop */}
          <Pressable
            style={[s.compareBtn, compareCrop ? s.compareBtnActive : null]}
            onPress={() => {
              if (compareCrop) {
                setCompareCrop(null);
              } else {
                const other = ALL_CROPS.find(c => c !== primaryCrop) || "rice";
                setCompareCrop(other);
              }
            }}
          >
            <Ionicons
              name={compareCrop ? "close-circle" : "git-compare"}
              size={16}
              color={compareCrop ? T.white : T.gold}
            />
            <Text style={[s.compareBtnText, compareCrop ? s.compareBtnTextActive : null]}>
              {compareCrop ? `Remove ${compareLabel} comparison` : "Compare with another crop"}
            </Text>
          </Pressable>

          {/* Crop selector pills for historical tab too */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.cropPillScroll} contentContainerStyle={s.cropPillContainer}>
            {ALL_CROPS.slice(0, 12).map(crop => {
              const info = cropInfo(crop);
              const active = crop === primaryCrop;
              return (
                <Pressable
                  key={crop}
                  style={[s.cropToggle, active && { backgroundColor: info.color, borderColor: info.color }]}
                  onPress={() => { setPrimaryCrop(crop); setCompareCrop(null); }}
                >
                  <Text style={[s.cropToggleText, active && s.cropToggleTextActive]}>
                    {info.emoji} {capitalize(crop)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Compare crop selector (only if comparing) */}
          {compareCrop && (
            <>
              <Text style={{ fontSize: 12, fontWeight: "700", color: T.sub, textAlign: "center", marginTop: 8, marginBottom: 4 }}>
                Compare with:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.cropPillScroll} contentContainerStyle={s.cropPillContainer}>
                {ALL_CROPS.filter(c => c !== primaryCrop).slice(0, 12).map(crop => {
                  const info = cropInfo(crop);
                  const active = crop === compareCrop;
                  return (
                    <Pressable
                      key={crop}
                      style={[s.cropToggle, active && { backgroundColor: info.color, borderColor: info.color }]}
                      onPress={() => setCompareCrop(crop)}
                    >
                      <Text style={[s.cropToggleText, active && s.cropToggleTextActive]}>
                        {info.emoji} {capitalize(crop)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Historical price entries */}
          {historyEntries.length > 0 ? (
            historyEntries.map((entry, i) => (
              <View key={i} style={s.historyCard}>
                <View style={s.historyLeft}>
                  <Text style={s.historyDate}>{entry.date}</Text>
                  {entry.mandi ? <Text style={s.historyMandi}>{entry.mandi}</Text> : null}
                  {entry.state ? <Text style={s.historyDateSub}>{entry.state}</Text> : null}
                </View>
                <View style={s.historyRight}>
                  <Text style={s.historyPrice}>₹{Math.round(entry.price)}/q</Text>
                  <Text style={[s.historyDelta, { color: entry.delta >= 0 ? T.green : T.red }]}>
                    {entry.delta >= 0 ? "+" : ""}{entry.delta.toFixed(1)}%
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={s.noDataWrap}>
              <Text style={s.noDataText}>No price history entries yet for {primaryLabel}</Text>
            </View>
          )}

          {/* Analyze Data CTA */}
          <Pressable style={s.ctaBtn} onPress={() => nav.navigate("MarketPrices", { crop: primaryCrop, location: locationFilter })}>
            <Ionicons name="analytics" size={18} color={T.white} />
            <Text style={s.ctaBtnText}>Analyze Data</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ═══════════ STYLES ═══════════ */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: T.bg,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: T.ink, textAlign: "center" },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },

  /* Tabs */
  tabRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 12,
    backgroundColor: T.cream, borderRadius: 12, padding: 3,
    borderWidth: 1, borderColor: T.cardBorder,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
  },
  tabActive: {
    backgroundColor: T.gold,
    ...Platform.select({
      ios: { shadowColor: T.goldDark, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 4 },
    }),
  },
  tabText: { fontSize: 14, fontWeight: "700", color: T.sub },
  tabTextActive: { color: T.white, fontWeight: "800" },

  /* Loading */
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  loaderText: { fontSize: 13, color: T.muted, fontWeight: "600" },

  /* Scroll */
  scroll: { paddingHorizontal: 16, paddingBottom: 110 },

  /* Map */
  mapCard: {
    backgroundColor: T.card, borderRadius: 18, padding: 8,
    borderWidth: 1, borderColor: T.cardBorder,
    alignItems: "center", overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: T.goldDark, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
    }),
  },

  /* Legend */
  legendRow: {
    flexDirection: "row", justifyContent: "center", gap: 24,
    marginTop: 10, marginBottom: 6,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, fontWeight: "600", color: T.sub },

  /* Handle (drag indicator) */
  handleWrap: { alignItems: "center", marginVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.divider },

  /* Section header */
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: T.ink },
  viewAll: { fontSize: 12, fontWeight: "700", color: T.gold },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: T.goldTint,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    color: T.sub,
  },

  /* Price row (side-by-side cards) */
  priceRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  priceCard: {
    flex: 1, backgroundColor: T.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: T.cardBorder,
    ...Platform.select({
      ios: { shadowColor: T.goldDark, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },
  priceCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  cropIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cropEmoji: { fontSize: 18 },
  priceInfo: { flex: 1 },
  cropLabel: { fontSize: 13, fontWeight: "800", color: T.ink },
  priceVal: { fontSize: 15, fontWeight: "900", color: T.ink, marginTop: 2 },
  priceDelta: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  sparkWrap: { alignItems: "center" },

  /* CTA button */
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.gold, borderRadius: 14, paddingVertical: 16, marginTop: 4,
    ...Platform.select({
      ios: { shadowColor: T.goldDark, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
    }),
  },
  ctaBtnText: { fontSize: 15, fontWeight: "900", color: T.white },

  /* ── Historical tab ── */
  dateRangeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    marginBottom: 14, marginTop: 4,
  },
  dateRangeLabel: { fontSize: 13, fontWeight: "700", color: T.ink },

  chartLegendRow: { flexDirection: "row", justifyContent: "center", gap: 24, marginBottom: 10 },
  chartLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  chartLegendDot: { width: 10, height: 10, borderRadius: 5 },
  chartLegendLabel: { fontSize: 11, fontWeight: "700", color: T.sub },

  chartCard: {
    backgroundColor: T.card, borderRadius: 16, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: T.cardBorder, alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: T.goldDark, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },

  historyCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: T.card, borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: T.cardBorder,
  },
  historyLeft: { flex: 1 },
  historyDate: { fontSize: 12, fontWeight: "700", color: T.ink },
  historyMandi: { fontSize: 11, fontWeight: "700", color: T.gold, marginTop: 2 },
  historyDateSub: { fontSize: 10, fontWeight: "600", color: T.muted, marginTop: 2 },
  historyRight: { alignItems: "flex-end" },
  historyPrice: { fontSize: 14, fontWeight: "900", color: T.ink },
  historyDelta: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  historyCropTitle: { fontSize: 16, fontWeight: "900", color: T.ink, textAlign: "center", marginTop: 4, marginBottom: 6 },

  compareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 12, paddingVertical: 10, marginTop: 6, marginBottom: 10,
    borderWidth: 1.5, borderColor: T.gold, backgroundColor: T.cream,
  },
  compareBtnActive: { backgroundColor: T.gold, borderColor: T.goldDark },
  compareBtnText: { fontSize: 13, fontWeight: "700", color: T.gold },
  compareBtnTextActive: { color: T.white },

  cropToggleRow: {
    flexDirection: "row", gap: 10, justifyContent: "center", marginBottom: 14,
  },
  cropToggle: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: T.cardBorder, backgroundColor: T.cream,
  },
  cropToggleActive: { backgroundColor: T.gold, borderColor: T.goldDark },
  cropToggleText: { fontSize: 12, fontWeight: "700", color: T.sub },
  cropToggleTextActive: { color: T.white, fontWeight: "800" },

  noDataWrap: { padding: 30, alignItems: "center" },
  noDataText: { fontSize: 13, color: T.muted, fontWeight: "600" },

  /* Crop search */
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: T.cardBorder, marginBottom: 10,
  },
  searchInput: {
    flex: 1, fontSize: 13, fontWeight: "600", color: T.ink, padding: 0,
  },

  /* Crop pill selector */
  cropPillScroll: { marginBottom: 10, maxHeight: 44 },
  cropPillContainer: { gap: 8, paddingRight: 8 },
  cropPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: T.cardBorder, backgroundColor: T.cream,
  },
  cropPillEmoji: { fontSize: 14 },
  cropPillText: { fontSize: 12, fontWeight: "700", color: T.sub },
});

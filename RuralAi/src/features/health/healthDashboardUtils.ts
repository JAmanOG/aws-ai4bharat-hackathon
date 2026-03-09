import type { HealthImagingType } from "../../services/api";

export const REPORT_TYPES: Array<{ label: string; value: HealthImagingType }> = [
  { label: "Lab report", value: "pathology" },
  { label: "X-ray", value: "xray" },
  { label: "MRI", value: "mri" },
  { label: "CT", value: "ct_scan" },
  { label: "Ultrasound", value: "ultrasound" },
];

type MimeAsset = {
  mimeType?: string | null;
  name?: string | null;
};

export function normalizeMimeType(asset: MimeAsset): "application/pdf" | "image/jpeg" | "image/png" | null {
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

export function formatReportType(value: HealthImagingType) {
  const match = REPORT_TYPES.find((entry) => entry.value === value);
  return match?.label || value.replace(/_/g, " ");
}

export function badgeLabel(label: string) {
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

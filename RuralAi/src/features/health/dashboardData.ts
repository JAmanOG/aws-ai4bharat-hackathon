import type { HealthPortal, HealthProvider } from "../../services/api";

const PRIORITY_PORTALS = [
  "Ayushman Bharat (PM-JAY)",
  "National Health Mission (NHM)",
  "Central Government Health Scheme (CGHS)",
  "eSanjeevani",
];

const PRIORITY_PROVIDERS = [
  "Apollo Hospitals",
  "PharmEasy",
  "Practo",
  "Tata 1mg",
  "mFine",
  "Fortis Hospital",
];

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function orderByPreferredName<T extends { id: string; name: string }>(items: T[], preferredNames: string[]) {
  const byName = new Map(items.map((item) => [normalize(item.name), item]));

  const ordered = preferredNames
    .map((name) => byName.get(normalize(name)))
    .filter(Boolean) as T[];

  const remaining = items
    .filter((item) => !ordered.some((entry) => entry.id === item.id))
    .sort((left, right) => left.name.localeCompare(right.name));

  return [...ordered, ...remaining];
}

export function buildHealthSchemeList(portals: HealthPortal[]) {
  return orderByPreferredName(portals, PRIORITY_PORTALS);
}

export function buildHealthProviderList(providers: HealthProvider[]) {
  const eligible = providers.filter((provider) => provider.website && provider.type !== "govt-hospital");
  return orderByPreferredName(eligible, PRIORITY_PROVIDERS);
}

export function findTelemedicinePortal(portals: HealthPortal[]) {
  return (
    portals.find((portal) => normalize(portal.name).includes("esanjeevani"))
    ?? portals.find((portal) => normalize(portal.category) === "telemedicine")
    ?? portals.find((portal) => normalize(portal.description).includes("telemedicine"))
    ?? null
  );
}

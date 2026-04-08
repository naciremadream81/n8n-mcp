import { readFile } from "node:fs/promises";

type EndpointHit = {
  method: string;
  url: string;
  status?: number;
  resourceType: string;
};

type NetworkReport = {
  county: string;
  startUrl: string;
  finalUrl: string;
  title: string;
  ok: boolean;
  endpoints: EndpointHit[];
};

type DiscoveryRoot = {
  reports: NetworkReport[];
};

type PlatformGuess = "accela" | "trakit" | "arcgis" | "custom";

type CatalogEntry = {
  county: string;
  portal_url: string;
  final_url: string;
  platform_guess: PlatformGuess;
  confidence_score: number;
  candidate_api_endpoints: string[];
  notes: string[];
};

const EXCLUDE_PATTERNS = [
  "google-analytics.com",
  "googletagmanager.com",
  "applicationinsights.azure.com",
  "cdn.datatables.net",
  "code.jquery.com",
  "translate.googleapis.com",
  "translate.google.com",
  "doubleclick.net",
  "facebook.com/tr",
  "ruxitagentjs",
  "dynatrace",
  ".css",
  ".png",
  ".jpg",
  ".svg",
  ".woff",
  ".woff2"
];

function cleanJson(raw: string): string {
  const start = raw.indexOf("{");
  return start >= 0 ? raw.slice(start) : raw;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isLikelyBusinessEndpoint(url: string): boolean {
  const lower = url.toLowerCase();
  if (EXCLUDE_PATTERNS.some((x) => lower.includes(x))) return false;

  const apiSignals = [
    "/api/",
    "/rest/",
    "/query?",
    "/query/",
    "featureServer".toLowerCase(),
    "MapServer".toLowerCase(),
    ".asmx",
    ".svc",
    "/services/",
    "default.aspx",
    "cap/caphome",
    "permits"
  ];
  return apiSignals.some((x) => lower.includes(x));
}

function guessPlatform(report: NetworkReport): { guess: PlatformGuess; confidence: number } {
  const corpus = `${report.startUrl} ${report.finalUrl} ${report.title} ${report.endpoints
    .map((e) => e.url)
    .join(" ")}`.toLowerCase();

  if (corpus.includes("accela")) return { guess: "accela", confidence: 0.92 };
  if (corpus.includes("trakit")) return { guess: "trakit", confidence: 0.9 };
  if (
    corpus.includes("arcgis") ||
    corpus.includes("featureserver") ||
    corpus.includes("mapserver")
  ) {
    return { guess: "arcgis", confidence: 0.9 };
  }
  return { guess: "custom", confidence: 0.75 };
}

function scoreConfidence(report: NetworkReport, platformBase: number, endpointCount: number): number {
  let score = platformBase;
  if (report.ok) score += 0.04;
  if (endpointCount >= 5) score += 0.04;
  if (endpointCount >= 12) score += 0.02;
  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
}

function createEntry(report: NetworkReport): CatalogEntry {
  const filtered = dedupe(
    report.endpoints
      .filter((e) => e.resourceType === "xhr" || e.resourceType === "fetch" || e.resourceType === "document")
      .map((e) => e.url)
      .filter(isLikelyBusinessEndpoint)
  ).slice(0, 40);

  const platform = guessPlatform(report);
  const confidence = scoreConfidence(report, platform.confidence, filtered.length);

  const notes: string[] = [];
  if (!report.ok) notes.push("Initial page load had errors/timeouts.");
  if (filtered.length === 0) notes.push("No likely business API endpoint detected from initial navigation.");
  if (report.finalUrl.toLowerCase().includes("error.aspx")) {
    notes.push("Portal redirected to error page; endpoint set may be incomplete.");
  }

  return {
    county: report.county,
    portal_url: report.startUrl,
    final_url: report.finalUrl,
    platform_guess: platform.guess,
    confidence_score: confidence,
    candidate_api_endpoints: filtered,
    notes
  };
}

async function main(): Promise<void> {
  const raw = await readFile("reports/network-discovery-all-counties.json", "utf8");
  const root = JSON.parse(cleanJson(raw)) as DiscoveryRoot;

  const entries = root.reports
    .map(createEntry)
    .sort((a, b) => a.county.localeCompare(b.county));

  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        countyCount: entries.length,
        entries
      },
      null,
      2
    )}\n`
  );
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Catalog build failed", error);
  process.exit(1);
});

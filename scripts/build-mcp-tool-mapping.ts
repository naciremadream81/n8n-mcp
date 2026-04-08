import { readFile } from "node:fs/promises";

type CatalogEntry = {
  county: string;
  portal_url: string;
  final_url: string;
  platform_guess: "accela" | "trakit" | "arcgis" | "custom";
  confidence_score: number;
  candidate_api_endpoints: string[];
  notes: string[];
};

type CatalogRoot = {
  generatedAt: string;
  countyCount: number;
  entries: CatalogEntry[];
};

type ToolName =
  | "search_permits"
  | "get_permit_status"
  | "get_county_requirements"
  | "get_permit_documents"
  | "submit_permit_package";

type EndpointClassification = {
  url: string;
  tags: string[];
  likely_method: "GET" | "POST" | "UNKNOWN";
  likely_auth: "none" | "session_cookie" | "api_key_or_oauth" | "unknown";
  mapped_tools: ToolName[];
};

type CountyToolMap = {
  county: string;
  confidence_score: number;
  platform_guess: CatalogEntry["platform_guess"];
  portal_url: string;
  endpoints: EndpointClassification[];
  tool_coverage: Record<ToolName, number>;
};

const TOOL_RULES: Array<{ tool: ToolName; keywords: string[] }> = [
  { tool: "search_permits", keywords: ["search", "query", "permit", "record", "parcel", "address"] },
  { tool: "get_permit_status", keywords: ["status", "inspection", "result", "workflow", "review"] },
  { tool: "get_county_requirements", keywords: ["checklist", "requirement", "documenttype", "fees", "fee", "schedule"] },
  { tool: "get_permit_documents", keywords: ["document", "attachment", "file", "upload", "download"] },
  { tool: "submit_permit_package", keywords: ["submit", "application", "apply", "create", "upload", "checkout"] }
];

function parseJson(raw: string): CatalogRoot {
  const start = raw.indexOf("{");
  return JSON.parse(start >= 0 ? raw.slice(start) : raw) as CatalogRoot;
}

function classifyAuth(url: string): EndpointClassification["likely_auth"] {
  const lower = url.toLowerCase();
  if (lower.includes("accela.com") || lower.includes("default.aspx") || lower.includes("cap/")) {
    return "session_cookie";
  }
  if (lower.includes("/api/") || lower.includes("token") || lower.includes("oauth")) {
    return "api_key_or_oauth";
  }
  if (lower.includes("query?") || lower.includes("featureserver") || lower.includes("mapserver")) {
    return "none";
  }
  return "unknown";
}

function classifyMethod(url: string): EndpointClassification["likely_method"] {
  const lower = url.toLowerCase();
  if (lower.includes("submit") || lower.includes("upload") || lower.includes("create")) return "POST";
  if (lower.includes("query") || lower.includes("search") || lower.includes("status")) return "GET";
  return "UNKNOWN";
}

function classifyEndpoint(url: string): EndpointClassification {
  const lower = url.toLowerCase();
  const tags = new Set<string>();
  const mappedTools = new Set<ToolName>();

  for (const { tool, keywords } of TOOL_RULES) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        tags.add(keyword);
        mappedTools.add(tool);
      }
    }
  }

  if (lower.includes("featureserver") || lower.includes("mapserver") || lower.includes("query?")) {
    tags.add("gis");
    mappedTools.add("search_permits");
  }

  return {
    url,
    tags: Array.from(tags),
    likely_method: classifyMethod(url),
    likely_auth: classifyAuth(url),
    mapped_tools: Array.from(mappedTools)
  };
}

function coverage(endpoints: EndpointClassification[]): Record<ToolName, number> {
  const base: Record<ToolName, number> = {
    search_permits: 0,
    get_permit_status: 0,
    get_county_requirements: 0,
    get_permit_documents: 0,
    submit_permit_package: 0
  };
  for (const endpoint of endpoints) {
    for (const tool of endpoint.mapped_tools) {
      base[tool] += 1;
    }
  }
  return base;
}

async function main(): Promise<void> {
  const raw = await readFile("reports/county_api_catalog.json", "utf8");
  const catalog = parseJson(raw);

  const counties: CountyToolMap[] = catalog.entries.map((entry) => {
    const classified = entry.candidate_api_endpoints.map(classifyEndpoint);
    return {
      county: entry.county,
      confidence_score: entry.confidence_score,
      platform_guess: entry.platform_guess,
      portal_url: entry.portal_url,
      endpoints: classified,
      tool_coverage: coverage(classified)
    };
  });

  const summary = counties.reduce(
    (acc, county) => {
      for (const tool of Object.keys(county.tool_coverage) as ToolName[]) {
        if (county.tool_coverage[tool] > 0) acc.counties_with_tool[tool] += 1;
      }
      return acc;
    },
    {
      countyCount: counties.length,
      counties_with_tool: {
        search_permits: 0,
        get_permit_status: 0,
        get_county_requirements: 0,
        get_permit_documents: 0,
        submit_permit_package: 0
      } as Record<ToolName, number>
    }
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceGeneratedAt: catalog.generatedAt,
        summary,
        counties
      },
      null,
      2
    )}\n`
  );
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Tool mapping build failed", error);
  process.exit(1);
});

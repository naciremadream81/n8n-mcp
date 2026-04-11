import type {
  GetCountyRequirementsInput,
  GetPermitDocumentsInput,
  GetPermitStatusInput,
  SearchPermitsInput,
  SubmitPermitPackageInput
} from "./types.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ToolResponse = {
  ok: boolean;
  tool: string;
  data: Record<string, unknown>;
  notes?: string[];
};

const nowIso = () => new Date().toISOString();
const REPORTS_DIR = path.resolve(process.cwd(), "reports");
const TOOL_MAP_PATH = path.join(REPORTS_DIR, "county_mcp_tool_mapping.json");
const API_CATALOG_PATH = path.join(REPORTS_DIR, "county_api_catalog.json");
const PORTAL_DISCOVERY_PATH = path.join(REPORTS_DIR, "county-portal-candidates.json");
const SUBMISSIONS_PATH = path.join(REPORTS_DIR, "submitted-permit-packages.json");

type ToolName =
  | "search_permits"
  | "get_permit_status"
  | "get_county_requirements"
  | "get_permit_documents"
  | "submit_permit_package";

type CountyToolMap = {
  county: string;
  confidence_score: number;
  platform_guess: "accela" | "trakit" | "arcgis" | "custom";
  portal_url: string;
  endpoints: Array<{
    url: string;
    tags: string[];
    likely_method: "GET" | "POST" | "UNKNOWN";
    likely_auth: "none" | "session_cookie" | "api_key_or_oauth" | "unknown";
    mapped_tools: ToolName[];
  }>;
  tool_coverage: Record<ToolName, number>;
};

type ToolMapRoot = {
  generatedAt: string;
  sourceGeneratedAt: string;
  summary: {
    countyCount: number;
    counties_with_tool: Record<ToolName, number>;
  };
  counties: CountyToolMap[];
};

type ApiCatalogRoot = {
  generatedAt: string;
  countyCount: number;
  entries: Array<{
    county: string;
    portal_url: string;
    final_url: string;
    platform_guess: "accela" | "trakit" | "arcgis" | "custom";
    confidence_score: number;
    candidate_api_endpoints: string[];
    notes: string[];
  }>;
};

type SubmissionRecord = {
  permit_number: string;
  county: string;
  submitted_at: string;
  submission_status:
    | "accepted_for_processing"
    | "queued_for_manual_review"
    | "rejected_validation";
  documents: Array<{
    name: string;
    mime_type: string;
    url?: string;
    content_base64?: string;
    checksum: string;
  }>;
};

type SubmissionStore = {
  generatedAt: string;
  records: SubmissionRecord[];
};

function normalizeCounty(value: string): string {
  return value
    .replace(/county/gi, "")
    .replace(/[^a-z\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchCountyName(targetCounty: string, candidateCounty: string): boolean {
  return normalizeCounty(targetCounty) === normalizeCounty(candidateCounty);
}

function parseJsonFromMaybePrefixedText<T>(raw: string): T {
  const jsonStart = raw.indexOf("{");
  return JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart) : raw) as T;
}

async function tryReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return parseJsonFromMaybePrefixedText<T>(raw);
  } catch {
    return null;
  }
}

async function getToolMap(): Promise<ToolMapRoot | null> {
  return tryReadJson<ToolMapRoot>(TOOL_MAP_PATH);
}

async function getApiCatalog(): Promise<ApiCatalogRoot | null> {
  return tryReadJson<ApiCatalogRoot>(API_CATALOG_PATH);
}

async function getPortalDiscovery(): Promise<
  { generatedAt: string; countyCount: number; results: Array<{ county: string; selected?: string }> } | null
> {
  return tryReadJson(PORTAL_DISCOVERY_PATH);
}

async function getSubmissionStore(): Promise<SubmissionStore> {
  const store = await tryReadJson<SubmissionStore>(SUBMISSIONS_PATH);
  return store ?? { generatedAt: nowIso(), records: [] };
}

async function saveSubmissionStore(store: SubmissionStore): Promise<void> {
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(SUBMISSIONS_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function summarizeCapability(
  countyMap: CountyToolMap | undefined,
  tool: ToolName
): "available" | "limited" | "unavailable" {
  if (!countyMap) return "unavailable";
  const count = countyMap.tool_coverage[tool] ?? 0;
  if (count >= 2) return "available";
  if (count === 1) return "limited";
  return "unavailable";
}

function deterministicChecksum(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(36)}`;
}

export async function searchPermits(
  input: SearchPermitsInput
): Promise<ToolResponse> {
  const [toolMap, apiCatalog, portalDiscovery] = await Promise.all([
    getToolMap(),
    getApiCatalog(),
    getPortalDiscovery()
  ]);

  const candidateCounties =
    toolMap?.counties.filter((county) => {
      if (!input.county) return true;
      return matchCountyName(input.county, county.county);
    }) ?? [];

  const permitTypeNeedle = input.permit_type?.toLowerCase();
  const addressNeedle = input.address?.toLowerCase();

  const permits = candidateCounties
    .flatMap((county) => {
      const countyCatalog = apiCatalog?.entries.find((entry) =>
        matchCountyName(entry.county, county.county)
      );
      const countyPortal = portalDiscovery?.results.find((result) =>
        matchCountyName(result.county, county.county)
      );

      const endpointCandidates = county.endpoints.filter((endpoint) => {
        if (permitTypeNeedle && !endpoint.url.toLowerCase().includes(permitTypeNeedle)) {
          return false;
        }
        if (addressNeedle && !endpoint.url.toLowerCase().includes("search")) {
          return false;
        }
        return endpoint.mapped_tools.includes("search_permits");
      });

      return endpointCandidates.slice(0, 5).map((endpoint, index) => ({
        permit_reference: `${county.county.toUpperCase().replace(/\s+/g, "-")}-${index + 1}`,
        county: county.county,
        source_endpoint: endpoint.url,
        likely_auth: endpoint.likely_auth,
        platform: county.platform_guess,
        capability: summarizeCapability(county, "search_permits"),
        portal_url: countyPortal?.selected ?? county.portal_url,
        confidence_score: countyCatalog?.confidence_score ?? county.confidence_score
      }));
    })
    .slice(0, 50);

  const notes: string[] = [];
  if (!toolMap) {
    notes.push(
      "Tool mapping report not found. Run `bun run catalog:map-tools > reports/county_mcp_tool_mapping.json`."
    );
  }
  if (!apiCatalog) {
    notes.push(
      "API catalog report not found. Run `bun run catalog:build > reports/county_api_catalog.json`."
    );
  }
  if (permits.length === 0) {
    notes.push("No permit candidates matched the input filters in current county catalog data.");
  }

  return {
    ok: true,
    tool: "search_permits",
    data: {
      query: input,
      permits,
      count: permits.length,
      generated_at: nowIso()
    },
    notes
  };
}

export async function getPermitStatus(
  input: GetPermitStatusInput
): Promise<ToolResponse> {
  const [toolMap, submissions] = await Promise.all([getToolMap(), getSubmissionStore()]);
  const countyMap = toolMap?.counties.find((county) =>
    matchCountyName(county.county, input.county)
  );
  const storedSubmission = submissions.records.find(
    (record) =>
      record.permit_number === input.permit_number &&
      matchCountyName(record.county, input.county)
  );

  const capability = summarizeCapability(countyMap, "get_permit_status");
  const status =
    storedSubmission?.submission_status === "accepted_for_processing"
      ? "submitted"
      : capability === "available"
        ? "integration_ready"
        : capability === "limited"
          ? "integration_partial"
          : "unknown";

  const stage =
    storedSubmission?.submission_status === "accepted_for_processing"
      ? "intake"
      : capability === "available"
        ? "status_endpoint_discovered"
        : "manual_follow_up";

  const notes: string[] = [];
  if (!storedSubmission) {
    notes.push("No local submission record found for this permit number.");
  }
  if (!countyMap) {
    notes.push("County not present in current tool mapping report.");
  } else if (capability !== "available") {
    notes.push(
      "County status endpoint coverage is limited. Confirm with county portal until live polling is added."
    );
  }

  return {
    ok: true,
    tool: "get_permit_status",
    data: {
      permit_number: input.permit_number,
      county: input.county,
      status,
      stage,
      outstanding_comments:
        storedSubmission?.submission_status === "rejected_validation"
          ? ["Submission was rejected by package validation rules."]
          : [],
      platform_guess: countyMap?.platform_guess ?? null,
      capability,
      last_submission_at: storedSubmission?.submitted_at ?? null,
      generated_at: nowIso()
    },
    notes
  };
}

export async function getCountyRequirements(
  input: GetCountyRequirementsInput
): Promise<ToolResponse> {
  const [toolMap, apiCatalog] = await Promise.all([getToolMap(), getApiCatalog()]);
  const countyMap = toolMap?.counties.find((county) =>
    matchCountyName(county.county, input.county)
  );
  const countyCatalog = apiCatalog?.entries.find((entry) =>
    matchCountyName(entry.county, input.county)
  );

  const normalizedPermit = input.permit_type.toLowerCase();
  const normalizedWorkType = input.work_type.toLowerCase();

  const baseChecklist = [
    "Permit application form",
    "Property owner authorization",
    "Contractor license details",
    "Work scope narrative"
  ];
  if (normalizedPermit.includes("electrical")) baseChecklist.push("Load calculation sheet");
  if (normalizedPermit.includes("roof")) baseChecklist.push("Roof product approval / NOA");
  if (normalizedWorkType.includes("new")) baseChecklist.push("Site plan and setbacks");
  if (normalizedWorkType.includes("remodel")) baseChecklist.push("Existing conditions photos");

  const endpointHints =
    countyMap?.endpoints
      .filter((endpoint) => endpoint.mapped_tools.includes("get_county_requirements"))
      .slice(0, 5)
      .map((endpoint) => ({
        url: endpoint.url,
        likely_method: endpoint.likely_method,
        likely_auth: endpoint.likely_auth
      })) ?? [];

  const fees = [
    {
      code: "permit_base",
      description: "Base permit intake fee",
      estimated_amount_usd: countyMap ? 75 : null
    },
    {
      code: "plan_review",
      description: "Plan review fee",
      estimated_amount_usd: countyMap?.platform_guess === "accela" ? 125 : 100
    }
  ];

  const notes: string[] = [];
  if (!countyMap) {
    notes.push(
      "County not found in tool mapping report. Requirements are generic baseline and should be confirmed manually."
    );
  }
  if ((countyMap?.tool_coverage.get_county_requirements ?? 0) === 0) {
    notes.push("No requirements endpoint detected for this county in current discovery data.");
  }

  return {
    ok: true,
    tool: "get_county_requirements",
    data: {
      county: input.county,
      permit_type: input.permit_type,
      work_type: input.work_type,
      checklist: baseChecklist,
      fees,
      endpoint_hints: endpointHints,
      county_confidence_score: countyCatalog?.confidence_score ?? countyMap?.confidence_score ?? null,
      platform_guess: countyMap?.platform_guess ?? countyCatalog?.platform_guess ?? null,
      generated_at: nowIso()
    },
    notes
  };
}

export async function getPermitDocuments(
  input: GetPermitDocumentsInput
): Promise<ToolResponse> {
  const [toolMap, submissions] = await Promise.all([getToolMap(), getSubmissionStore()]);
  const countyMap = toolMap?.counties.find((county) =>
    matchCountyName(county.county, input.county)
  );

  const record = submissions.records.find(
    (submission) =>
      submission.permit_number === input.permit_number &&
      matchCountyName(submission.county, input.county)
  );

  const documents =
    record?.documents.map((document) => ({
      name: document.name,
      mime_type: document.mime_type,
      url: document.url ?? null,
      has_inline_content: Boolean(document.content_base64),
      checksum: document.checksum
    })) ?? [];

  const notes: string[] = [];
  if (!record) {
    notes.push("No locally tracked documents found for this permit.");
  }
  if ((countyMap?.tool_coverage.get_permit_documents ?? 0) === 0) {
    notes.push("No county document endpoint detected; returning locally tracked submission documents.");
  }

  return {
    ok: true,
    tool: "get_permit_documents",
    data: {
      permit_number: input.permit_number,
      county: input.county,
      documents,
      source: record ? "local_submission_store" : "none",
      generated_at: nowIso()
    },
    notes
  };
}

export async function submitPermitPackage(
  input: SubmitPermitPackageInput
): Promise<ToolResponse> {
  const [toolMap, submissions] = await Promise.all([getToolMap(), getSubmissionStore()]);
  const countyMap = toolMap?.counties.find((county) =>
    matchCountyName(county.county, input.county)
  );

  const validationErrors = input.documents.flatMap((document, index) => {
    const issues: string[] = [];
    if (!document.url && !document.content_base64) {
      issues.push(`documents[${index}] must include either url or content_base64`);
    }
    return issues;
  });

  const submissionStatus: SubmissionRecord["submission_status"] =
    validationErrors.length > 0
      ? "rejected_validation"
      : countyMap && countyMap.tool_coverage.submit_permit_package > 0
        ? "accepted_for_processing"
        : "queued_for_manual_review";

  const persistedRecord: SubmissionRecord = {
    permit_number: input.permit_number,
    county: input.county,
    submission_status: submissionStatus,
    submitted_at: nowIso(),
    documents: input.documents.map((document) => ({
      name: document.name,
      mime_type: document.mime_type,
      url: document.url,
      content_base64: document.content_base64,
      checksum: deterministicChecksum(
        `${document.name}:${document.mime_type}:${document.url ?? ""}:${document.content_base64 ?? ""}`
      )
    }))
  };

  const existingIndex = submissions.records.findIndex(
    (record) =>
      record.permit_number === input.permit_number &&
      matchCountyName(record.county, input.county)
  );
  if (existingIndex >= 0) {
    submissions.records[existingIndex] = persistedRecord;
  } else {
    submissions.records.push(persistedRecord);
  }
  submissions.generatedAt = nowIso();
  await saveSubmissionStore(submissions);

  const notes: string[] = [];
  if (!countyMap) {
    notes.push("County not found in tool mapping. Submission queued for manual review.");
  }
  if (validationErrors.length > 0) {
    notes.push(...validationErrors);
  }

  return {
    ok: validationErrors.length === 0,
    tool: "submit_permit_package",
    data: {
      permit_number: input.permit_number,
      county: input.county,
      received_documents: input.documents.length,
      submission_status: submissionStatus,
      submitted_at: persistedRecord.submitted_at,
      integration_capability: summarizeCapability(countyMap, "submit_permit_package")
    },
    notes
  };
}

import { z } from "zod";
import {
  getCountyRequirements,
  getPermitDocuments,
  getPermitStatus,
  searchPermits,
  submitPermitPackage
} from "./service.js";
import {
  GetCountyRequirementsInputSchema,
  GetPermitDocumentsInputSchema,
  GetPermitStatusInputSchema,
  SearchPermitsInputSchema,
  SubmitPermitPackageInputSchema
} from "./types.js";

const ToolNameSchema = z.enum([
  "search_permits",
  "get_permit_status",
  "get_county_requirements",
  "get_permit_documents",
  "submit_permit_package"
]);

type ToolName = z.infer<typeof ToolNameSchema>;

type ToolHandler = (payload: unknown) => Promise<unknown>;

const handlers: Record<ToolName, ToolHandler> = {
  search_permits: async (payload) => {
    const parsed = SearchPermitsInputSchema.parse(payload);
    return searchPermits(parsed);
  },
  get_permit_status: async (payload) => {
    const parsed = GetPermitStatusInputSchema.parse(payload);
    return getPermitStatus(parsed);
  },
  get_county_requirements: async (payload) => {
    const parsed = GetCountyRequirementsInputSchema.parse(payload);
    return getCountyRequirements(parsed);
  },
  get_permit_documents: async (payload) => {
    const parsed = GetPermitDocumentsInputSchema.parse(payload);
    return getPermitDocuments(parsed);
  },
  submit_permit_package: async (payload) => {
    const parsed = SubmitPermitPackageInputSchema.parse(payload);
    return submitPermitPackage(parsed);
  }
};

const port = Number(process.env.BRIDGE_PORT ?? 8787);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function readPathToolName(url: URL): ToolName | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "tool") return null;
  const parsed = ToolNameSchema.safeParse(parts[1]);
  return parsed.success ? parsed.data : null;
}

const server = Bun.serve({
  port,
  async fetch(req: Request) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "n8n-mcp-http-bridge",
        port,
        tools: ToolNameSchema.options
      });
    }

    if (req.method !== "POST") {
      return json(
        {
          ok: false,
          error: "method_not_allowed",
          message: "Use POST /tool/:name with a JSON payload."
        },
        405
      );
    }

    const toolName = readPathToolName(url);
    if (!toolName) {
      return json(
        {
          ok: false,
          error: "invalid_tool_path",
          message:
            "Valid route format is POST /tool/:name where :name is one of search_permits|get_permit_status|get_county_requirements|get_permit_documents|submit_permit_package."
        },
        404
      );
    }

    try {
      const payload = await req.json();
      const result = await handlers[toolName](payload);
      return json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return json(
          {
            ok: false,
            tool: toolName,
            error: "validation_error",
            details: error.issues
          },
          400
        );
      }

      return json(
        {
          ok: false,
          tool: toolName,
          error: "internal_error",
          message: error instanceof Error ? error.message : "Unknown bridge failure."
        },
        500
      );
    }
  }
});

// eslint-disable-next-line no-console
console.error(`[n8n-mcp-bridge] listening on http://localhost:${server.port}`);

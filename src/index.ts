import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

const server = new McpServer({
  name: "florida-permit-orchestrator",
  version: "0.1.0"
});

server.tool(
  "search_permits",
  "Search Florida permits by address or parcel.",
  {
    address: z.string().optional(),
    county: z.string().optional(),
    permit_type: z.string().optional(),
    date_range: z
      .object({
        from: z.string().optional(),
        to: z.string().optional()
      })
      .optional()
  },
  async (input) => {
    const parsed = SearchPermitsInputSchema.parse(input);
    const data = await searchPermits(parsed);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

server.tool(
  "get_permit_status",
  "Get real-time status of a permit.",
  {
    permit_number: z.string(),
    county: z.string()
  },
  async (input) => {
    const parsed = GetPermitStatusInputSchema.parse(input);
    const data = await getPermitStatus(parsed);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

server.tool(
  "get_county_requirements",
  "Get checklist and required docs for a permit type.",
  {
    county: z.string(),
    permit_type: z.string(),
    work_type: z.string()
  },
  async (input) => {
    const parsed = GetCountyRequirementsInputSchema.parse(input);
    const data = await getCountyRequirements(parsed);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

server.tool(
  "get_permit_documents",
  "Retrieve attached docs for a permit.",
  {
    permit_number: z.string(),
    county: z.string()
  },
  async (input) => {
    const parsed = GetPermitDocumentsInputSchema.parse(input);
    const data = await getPermitDocuments(parsed);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

server.tool(
  "submit_permit_package",
  "Submit assembled permit package to county portal.",
  {
    permit_number: z.string(),
    documents: z.array(
      z.object({
        name: z.string(),
        mime_type: z.string(),
        url: z.string().url().optional(),
        content_base64: z.string().optional()
      })
    ),
    county: z.string()
  },
  async (input) => {
    const parsed = SubmitPermitPackageInputSchema.parse(input);
    const data = await submitPermitPackage(parsed);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start MCP server", error);
  process.exit(1);
});

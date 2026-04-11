# n8n MCP: Florida Permit Orchestrator

Production-style MCP server scaffold and county portal discovery pipeline for Florida permit workflows.

Implemented MCP tools:

- `search_permits`
- `get_permit_status`
- `get_county_requirements`
- `get_permit_documents`
- `submit_permit_package`

---

## Easy Manual (Step by Step)

## 1) One-Time Setup

1. Open terminal in this project:
   - `cd "/Users/seans/codebase/n8n mcp"`
2. Install dependencies:
   - `bun install`
3. Install Playwright browser:
   - `bunx playwright install chromium`
4. Ensure reports folder exists:
   - `mkdir -p reports`

## 2) Run Full 67-County Discovery

Run these commands in order:

1. Discover likely permit portals:
   - `bun run discover:portals:all > reports/county-portal-candidates.json`
2. Capture browser network endpoints (interactive crawl):
   - `bun run discover:network:all > reports/network-discovery-all-counties.json`
3. Build normalized county API catalog:
   - `bun run catalog:build > reports/county_api_catalog.json`
4. Build MCP tool mapping report:
   - `bun run catalog:map-tools > reports/county_mcp_tool_mapping.json`

## 3) Understand the Output Files

- `reports/county-portal-candidates.json`
  - Best candidate portal URL per county.
- `reports/network-discovery-all-counties.json`
  - Raw captured network traffic from browser crawling.
- `reports/county_api_catalog.json`
  - Filtered candidate API/business endpoints with confidence.
- `reports/county_mcp_tool_mapping.json`
  - Endpoint classification and estimated coverage for MCP tools.

## 4) Run the MCP Server

Development mode:

- `bun run dev`

Build and run:

- `bun run build`
- `bun run start`

## 5) Run HTTP Bridge for n8n

Start the bridge (this is what n8n calls):

- `bun run bridge:dev`

Bridge endpoints:

- `GET /health`
- `POST /tool/search_permits`
- `POST /tool/get_permit_status`
- `POST /tool/get_county_requirements`
- `POST /tool/get_permit_documents`
- `POST /tool/submit_permit_package`

Default bridge URL is `http://127.0.0.1:8787`.

## 6) Import n8n Workflow

1. In n8n UI, choose **Workflows -> Import from File**.
2. Import:
   - `n8n/workflows/florida-permit-orchestrator.json`
3. Activate the workflow and use the webhook path:
   - `POST /webhook/florida-permit-orchestrator`

Webhook body format:

```json
{
  "action": "search_permits",
  "payload": {
    "county": "Orange",
    "address": "123 Main St",
    "permit_type": "building"
  }
}
```

`action` can be one of:

- `search_permits`
- `get_permit_status`
- `get_county_requirements`
- `get_permit_documents`
- `submit_permit_package`

## 7) Current State of Integrations

- Server and tools are fully scaffolded with schema validation.
- Discovery/capture/catalog pipelines are automated.
- Tool handlers in `src/service.ts` are wired to discovered county coverage data and local submission persistence.
- Full county-authenticated transactional submission is still a future enhancement.

## 8) Weekly Operations Routine

1. Re-run the full discovery pipeline (Section 2).
2. Review output changes in `reports/`.
3. Update `src/service.ts` with any changed endpoints/workflows.
4. Validate:
   - `bun run typecheck`
   - `bun run build`

## 9) Troubleshooting

- Playwright browser missing:
  - `bunx playwright install chromium`
- Long runtimes on all-county crawl:
  - Expected. The interactive 67-county run can take significant time.
- Some counties return weak endpoint coverage:
  - Common for login/session-protected portals. Use authenticated crawl mode in future iteration.

## 10) Copy/Paste Quick Start

```bash
cd "/Users/seans/codebase/n8n mcp"
bun install
bunx playwright install chromium
mkdir -p reports
bun run discover:portals:all > reports/county-portal-candidates.json
bun run discover:network:all > reports/network-discovery-all-counties.json
bun run catalog:build > reports/county_api_catalog.json
bun run catalog:map-tools > reports/county_mcp_tool_mapping.json
bun run bridge:dev
```

---

## Bun Script Reference

- `bun run dev` - run MCP server in stdio dev mode
- `bun run bridge:dev` - run HTTP bridge for n8n
- `bun run build` - compile TypeScript
- `bun run start` - run compiled MCP server
- `bun run bridge:start` - run bridge without hot reload
- `bun run typecheck` - run TS type checks
- `bun run discover:endpoints` - quick endpoint probe (small target list)
- `bun run discover:network` - quick network capture (small target list)
- `bun run discover:portals:all` - portal discovery for all 67 counties
- `bun run discover:network:all` - interactive network capture for all 67 counties
- `bun run catalog:build` - normalize endpoint catalog
- `bun run catalog:map-tools` - map endpoints to MCP tool coverage

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
   - `npm install`
3. Install Playwright browser:
   - `npx playwright install chromium`
4. Ensure reports folder exists:
   - `mkdir -p reports`

## 2) Run Full 67-County Discovery

Run these commands in order:

1. Discover likely permit portals:
   - `npm run discover:portals:all > reports/county-portal-candidates.json`
2. Capture browser network endpoints (interactive crawl):
   - `npm run discover:network:all > reports/network-discovery-all-counties.json`
3. Build normalized county API catalog:
   - `npm run catalog:build > reports/county_api_catalog.json`
4. Build MCP tool mapping report:
   - `npm run catalog:map-tools > reports/county_mcp_tool_mapping.json`

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

- `npm run dev`

Build and run:

- `npm run build`
- `npm run start`

## 5) Current State of Integrations

- Server and tools are fully scaffolded with schema validation.
- Discovery/capture/catalog pipelines are automated.
- Tool handlers in `src/service.ts` are currently stubs and must be wired to real county integrations.

## 6) Weekly Operations Routine

1. Re-run the full discovery pipeline (Section 2).
2. Review output changes in `reports/`.
3. Update `src/service.ts` with any changed endpoints/workflows.
4. Validate:
   - `npm run typecheck`
   - `npm run build`

## 7) Troubleshooting

- Playwright browser missing:
  - `npx playwright install chromium`
- Long runtimes on all-county crawl:
  - Expected. The interactive 67-county run can take significant time.
- Some counties return weak endpoint coverage:
  - Common for login/session-protected portals. Use authenticated crawl mode in future iteration.

## 8) Copy/Paste Quick Start

```bash
cd "/Users/seans/codebase/n8n mcp"
npm install
npx playwright install chromium
mkdir -p reports
npm run discover:portals:all > reports/county-portal-candidates.json
npm run discover:network:all > reports/network-discovery-all-counties.json
npm run catalog:build > reports/county_api_catalog.json
npm run catalog:map-tools > reports/county_mcp_tool_mapping.json
npm run dev
```

---

## NPM Script Reference

- `npm run dev` - run MCP server in dev mode
- `npm run build` - compile TypeScript
- `npm run start` - run compiled server
- `npm run typecheck` - run TS type checks
- `npm run discover:endpoints` - quick endpoint probe (small target list)
- `npm run discover:network` - quick network capture (small target list)
- `npm run discover:portals:all` - portal discovery for all 67 counties
- `npm run discover:network:all` - interactive network capture for all 67 counties
- `npm run catalog:build` - normalize endpoint catalog
- `npm run catalog:map-tools` - map endpoints to MCP tool coverage

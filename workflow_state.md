# Workflow State

## State
- Status: IN_PROGRESS
- Workflow: n8n MCP Tool Buildout
- Phase: CONSTRUCT

## Plan
1. Add an n8n-callable HTTP bridge in this repo:
   - create a Bun HTTP server (`src/http-bridge.ts`) with one POST endpoint: `/tool/:name`
   - parse JSON body and route to existing service handlers:
     - `search_permits`
     - `get_permit_status`
     - `get_county_requirements`
     - `get_permit_documents`
     - `submit_permit_package`
   - return consistent JSON envelope: `{ ok, tool, data, notes, error? }`
2. Wire runtime scripts:
   - add `bun run bridge:dev` and `bun run bridge:start` scripts in `package.json`
   - ensure MCP stdio server remains unchanged (`src/index.ts`) for MCP clients
3. Add n8n importable workflow JSON:
   - create `n8n/workflows/florida-permit-orchestrator.json`
   - flow pseudocode:
     - webhook trigger receives `action` + payload
     - switch on `action`
     - HTTP Request node posts to bridge `/tool/:name`
     - unified response node returns tool output
   - include action branches for all 5 tools
4. Add setup and run docs for n8n mode:
   - update `README.md` with:
     - start bridge command
     - n8n import instructions
     - webhook payload examples per action
5. Validate end-to-end locally:
   - run `bun run typecheck`
   - run `bun run build`
   - smoke test bridge with one `curl` call per tool
   - confirm workflow JSON is structurally valid for n8n import

## Log
- Scope changed from permit case intake to MCP tool product buildout.
- Plan approved by user.
- Scaffolded TypeScript MCP server with the 5 requested permit tools.
- Added schema validation, service stubs, scripts, env template, and README.
- Added county endpoint discovery script and initial live probe results.
- Added Playwright network-capture script for extracting XHR/fetch endpoints.
- Added automated 67-county portal discovery and full-county network capture scripts.
- Generated reports for all 67 Florida counties with automated endpoint extraction.
- Added catalog normalization pipeline to emit `county_api_catalog.json` with platform guess and confidence.
- Upgraded 67-county network capture with autonomous interaction heuristics (click/search/submit/follow links).
- Re-ran full-state crawl and regenerated API catalog with high endpoint yield.
- Added endpoint classification and MCP tool-mapping generator with per-county coverage output.
- Started BLUEPRINT for final n8n wiring: HTTP bridge + importable n8n workflow + docs + smoke tests.
- Added `src/http-bridge.ts` to expose `/tool/:name` HTTP endpoints for all 5 permit tools.
- Added bridge scripts in `package.json`: `bridge:dev`, `bridge:start`.
- Added importable workflow: `n8n/workflows/florida-permit-orchestrator.json`.
- Updated README with Bun commands, n8n import steps, webhook contract, and bridge usage.
- Updated TypeScript config to include Bun types and validated bridge typing.
- Verified with: `bun run typecheck`, `bun run build`, and live `curl` smoke tests for health + all 5 tools.

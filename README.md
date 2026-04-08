# n8n MCP: Florida Permit Orchestrator

MCP server scaffold for permit workflows with the following tools:

- `search_permits`
- `get_permit_status`
- `get_county_requirements`
- `get_permit_documents`
- `submit_permit_package`

## Quick Start

1. Install dependencies:
   - `npm install`
2. Start in dev mode:
   - `npm run dev`
3. Typecheck:
   - `npm run typecheck`
4. Build:
   - `npm run build`

## Notes

- Current handlers are production-safe stubs with validated input schemas.
- Replace `src/service.ts` stub implementations with real county/MCP integration logic.
- Keep `submit_permit_package` behind explicit user confirmation in orchestration flows.

## Endpoint Discovery

1. Basic endpoint probe:
   - `npm run discover:endpoints`
2. Browser network capture (XHR/fetch/script/document):
   - `npx playwright install chromium`
   - `npm run discover:network`

The network capture prints JSON with per-county URL loads and discovered endpoint calls.

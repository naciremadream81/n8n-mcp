import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

type DiscoveryFile = {
  results: Array<{ county: string; selected?: string }>;
};

type NetworkHit = {
  method: string;
  url: string;
  status?: number;
  resourceType: string;
};

type CountyReport = {
  county: string;
  startUrl: string;
  finalUrl: string;
  title: string;
  ok: boolean;
  error?: string;
  endpoints: NetworkHit[];
};

function shouldKeep(resourceType: string): boolean {
  return ["fetch", "xhr", "document", "script"].includes(resourceType);
}

const INTERACTION_KEYWORDS = [
  "permit",
  "search",
  "status",
  "inspection",
  "record",
  "building",
  "apply",
  "application"
];

async function safeClick(
  page: import("playwright").Page,
  selector: string
): Promise<boolean> {
  try {
    const loc = page.locator(selector).first();
    if ((await loc.count()) === 0) return false;
    await loc.click({ timeout: 2500 });
    await page.waitForTimeout(1500);
    return true;
  } catch {
    return false;
  }
}

async function fillSearchInputs(page: import("playwright").Page): Promise<void> {
  const inputs = page.locator("input[type='text'], input[type='search'], input:not([type])");
  const max = Math.min(await inputs.count(), 6);
  for (let i = 0; i < max; i += 1) {
    try {
      const input = inputs.nth(i);
      const placeholder = ((await input.getAttribute("placeholder")) ?? "").toLowerCase();
      if (
        placeholder.includes("address") ||
        placeholder.includes("parcel") ||
        placeholder.includes("permit") ||
        placeholder.includes("file")
      ) {
        await input.fill("123");
      }
    } catch {
      // continue best-effort
    }
  }
}

async function runHeuristicInteractions(
  page: import("playwright").Page
): Promise<void> {
  await fillSearchInputs(page);

  // Click likely navigation links first.
  for (const keyword of INTERACTION_KEYWORDS) {
    await safeClick(
      page,
      `a:has-text("${keyword}"), button:has-text("${keyword}"), [role="button"]:has-text("${keyword}")`
    );
  }

  // Try generic form submissions.
  await safeClick(page, "button[type='submit']");
  await safeClick(page, "input[type='submit']");

  // Follow top few in-domain links that look permit-related.
  const links = await page
    .locator("a[href]")
    .evaluateAll((anchors) =>
      anchors
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((href) => /permit|inspection|record|status|search|apply/i.test(href))
        .slice(0, 3)
    );
  for (const href of links) {
    try {
      await page.goto(href, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1200);
      await fillSearchInputs(page);
      await safeClick(page, "button[type='submit']");
      await safeClick(page, "input[type='submit']");
    } catch {
      // best-effort
    }
  }
}

async function captureOne(
  page: import("playwright").Page,
  county: string,
  startUrl: string
): Promise<CountyReport> {
  const hits = new Map<string, NetworkHit>();

  const onReq = (req: import("playwright").Request) => {
    const resourceType = req.resourceType();
    if (!shouldKeep(resourceType)) return;
    const key = `${req.method()} ${req.url()}`;
    if (!hits.has(key)) {
      hits.set(key, {
        method: req.method(),
        url: req.url(),
        resourceType
      });
    }
  };

  const onRes = (res: import("playwright").Response) => {
    const req = res.request();
    const resourceType = req.resourceType();
    if (!shouldKeep(resourceType)) return;
    const key = `${req.method()} ${req.url()}`;
    const hit = hits.get(key);
    if (hit) {
      hit.status = res.status();
    } else {
      hits.set(key, {
        method: req.method(),
        url: req.url(),
        status: res.status(),
        resourceType
      });
    }
  };

  page.on("request", onReq);
  page.on("response", onRes);

  try {
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    await runHeuristicInteractions(page);
    await page.waitForTimeout(2500);
    return {
      county,
      startUrl,
      finalUrl: page.url(),
      title: await page.title(),
      ok: true,
      endpoints: Array.from(hits.values())
    };
  } catch (error) {
    return {
      county,
      startUrl,
      finalUrl: page.url(),
      title: await page.title().catch(() => ""),
      ok: false,
      error: error instanceof Error ? error.message : "unknown_error",
      endpoints: Array.from(hits.values())
    };
  } finally {
    page.off("request", onReq);
    page.off("response", onRes);
  }
}

async function main(): Promise<void> {
  const raw = await readFile("reports/county-portal-candidates.json", "utf8");
  const jsonStart = raw.indexOf("{");
  const jsonRaw = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
  const discovery = JSON.parse(jsonRaw) as DiscoveryFile;
  const targets = discovery.results.filter((r) => Boolean(r.selected));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "n8n-mcp-network-capture-all/0.1"
  });

  const reports: CountyReport[] = [];
  for (const target of targets) {
    const page = await context.newPage();
    const report = await captureOne(page, target.county, target.selected!);
    reports.push(report);
    await page.close();
  }

  await context.close();
  await browser.close();

  process.stdout.write(
    `${JSON.stringify(
      { generatedAt: new Date().toISOString(), countyCount: reports.length, reports },
      null,
      2
    )}\n`
  );
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Network capture all counties failed", error);
  process.exit(1);
});

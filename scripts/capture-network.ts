import { chromium } from "playwright";

type Target = {
  county: string;
  url: string;
};

type NetworkHit = {
  type: string;
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

const targets: Target[] = [
  {
    county: "Miami-Dade",
    url: "https://www.miamidade.gov/Apps/ISD/MDC_OES_Permitting/Permit/CheckPermitStatus"
  },
  {
    county: "Broward",
    url: "https://dpepp.broward.org/EPermitsAPP/Default.aspx"
  },
  {
    county: "Orange",
    url: "https://cp-fasttrack.ocfl.net/OnlineServices/Default.aspx/PermitsAllTypes.aspx"
  },
  {
    county: "Hillsborough",
    url: "https://www.hillsboroughcounty.org/en/residents/permits"
  },
  {
    county: "Palm Beach",
    url: "https://www.pbcgov.org/ePZB.Admin.WebSPA"
  },
  {
    county: "Polk",
    url: "https://aca-prod.accela.com/POLKCO/Default.aspx"
  },
  {
    county: "Okeechobee",
    url: "https://www.okeechobeetrakit.com/"
  },
  {
    county: "Lee",
    url: "https://aca-prod.accela.com/LEECO/Default.aspx"
  }
];

function shouldKeepRequest(resourceType: string): boolean {
  return ["fetch", "xhr", "document", "script"].includes(resourceType);
}

async function inspectTarget(
  page: import("playwright").Page,
  target: Target
): Promise<CountyReport> {
  const hits = new Map<string, NetworkHit>();

  const recordRequest = (request: import("playwright").Request) => {
    const resourceType = request.resourceType();
    if (!shouldKeepRequest(resourceType)) {
      return;
    }

    const key = `${request.method()} ${request.url()}`;
    if (!hits.has(key)) {
      hits.set(key, {
        type: "request",
        method: request.method(),
        url: request.url(),
        resourceType
      });
    }
  };

  const recordResponse = (response: import("playwright").Response) => {
    const request = response.request();
    const resourceType = request.resourceType();
    if (!shouldKeepRequest(resourceType)) {
      return;
    }

    const key = `${request.method()} ${request.url()}`;
    const existing = hits.get(key);
    if (existing) {
      existing.status = response.status();
      existing.type = "response";
      return;
    }

    hits.set(key, {
      type: "response",
      method: request.method(),
      url: request.url(),
      status: response.status(),
      resourceType
    });
  };

  page.on("request", recordRequest);
  page.on("response", recordResponse);

  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(6000);

    return {
      county: target.county,
      startUrl: target.url,
      finalUrl: page.url(),
      title: await page.title(),
      ok: true,
      endpoints: Array.from(hits.values()).sort((a, b) =>
        a.url.localeCompare(b.url)
      )
    };
  } catch (error) {
    return {
      county: target.county,
      startUrl: target.url,
      finalUrl: page.url(),
      title: await page.title().catch(() => ""),
      ok: false,
      error: error instanceof Error ? error.message : "unknown_error",
      endpoints: Array.from(hits.values()).sort((a, b) =>
        a.url.localeCompare(b.url)
      )
    };
  } finally {
    page.off("request", recordRequest);
    page.off("response", recordResponse);
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "n8n-mcp-network-capture/0.1"
  });

  const reports: CountyReport[] = [];
  for (const target of targets) {
    const page = await context.newPage();
    const report = await inspectTarget(page, target);
    reports.push(report);
    await page.close();
  }

  await context.close();
  await browser.close();

  process.stdout.write(
    `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`
  );
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Network capture failed", error);
  process.exit(1);
});

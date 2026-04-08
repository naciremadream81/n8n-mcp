type Candidate = {
  county: string;
  label: string;
  url: string;
};

type ProbeResult = Candidate & {
  ok: boolean;
  status: number;
  finalUrl: string;
};

const candidates: Candidate[] = [
  {
    county: "Miami-Dade",
    label: "Permit status page",
    url: "https://www.miamidade.gov/Apps/ISD/MDC_OES_Permitting/Permit/CheckPermitStatus"
  },
  {
    county: "Miami-Dade",
    label: "ArcGIS permits layer",
    url: "https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/0/query?where=1%3D1&outFields=*&f=pjson"
  },
  {
    county: "Broward",
    label: "ePermits landing",
    url: "https://dpepp.broward.org/EPermitsAPP/Default.aspx"
  },
  {
    county: "Orange",
    label: "FastTrack home",
    url: "https://cp-fasttrack.ocfl.net/OnlineServices/Default.aspx/PermitsAllTypes.aspx"
  },
  {
    county: "Hillsborough",
    label: "ArcGIS FeatureServer",
    url: "https://gisdextweb1.hillsboroughcounty.org/arcgis/rest/services/Hosted/PermitsForDSDViewer/FeatureServer?f=pjson"
  },
  {
    county: "Palm Beach",
    label: "Permit portal",
    url: "https://www.pbcgov.org/PermitPortal"
  },
  {
    county: "Palm Beach",
    label: "ePZB SPA",
    url: "https://www.pbcgov.org/ePZB.Admin.WebSPA"
  },
  {
    county: "Polk",
    label: "Accela Citizen Access",
    url: "https://aca-prod.accela.com/POLKCO/Default.aspx"
  },
  {
    county: "Okeechobee",
    label: "eTRAKiT",
    url: "https://www.okeechobeetrakit.com/"
  },
  {
    county: "Lee",
    label: "Accela Citizen Access",
    url: "https://aca-prod.accela.com/LEECO/Default.aspx"
  }
];

async function probe(candidate: Candidate): Promise<ProbeResult> {
  try {
    const response = await fetch(candidate.url, {
      redirect: "follow",
      headers: {
        "user-agent": "n8n-mcp-endpoint-discovery/0.1"
      }
    });
    return {
      ...candidate,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url
    };
  } catch {
    return {
      ...candidate,
      ok: false,
      status: 0,
      finalUrl: candidate.url
    };
  }
}

async function main(): Promise<void> {
  const results = await Promise.all(candidates.map((item) => probe(item)));
  const report = {
    generatedAt: new Date().toISOString(),
    results
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Endpoint discovery failed", error);
  process.exit(1);
});

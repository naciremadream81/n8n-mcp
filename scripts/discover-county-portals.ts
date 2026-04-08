import { FLORIDA_COUNTIES } from "./florida-counties.js";

type Candidate = { url: string; sourceQuery: string; score: number };
type CountyDiscovery = {
  county: string;
  queries: string[];
  candidates: Candidate[];
  selected?: string;
};

const MAX_CANDIDATES_PER_QUERY = 8;
const TOP_PER_COUNTY = 10;

function scoreUrl(url: string, county: string): number {
  const u = url.toLowerCase();
  let score = 0;
  if (u.includes("permit")) score += 5;
  if (u.includes("building")) score += 4;
  if (u.includes("accela")) score += 6;
  if (u.includes("trakit")) score += 6;
  if (u.includes("fasttrack")) score += 5;
  if (u.includes("epzb")) score += 5;
  if (u.includes("gov")) score += 2;
  if (u.includes(county.toLowerCase().replace(/\s+/g, ""))) score += 3;
  if (u.includes("facebook.com") || u.includes("youtube.com")) score -= 10;
  return score;
}

function decodeDuckDuckGoLink(rawUrl: string): string | null {
  try {
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
    const m = rawUrl.match(/uddg=([^&]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

async function searchDuckDuckGo(query: string): Promise<string[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "user-agent": "n8n-mcp-discovery/0.1" } });
  if (!res.ok) return [];
  const html = await res.text();
  const matches = html.match(/href="([^"]+)"/g) ?? [];
  const urls: string[] = [];
  for (const match of matches) {
    const raw = match.slice(6, -1);
    const decoded = decodeDuckDuckGoLink(raw);
    if (!decoded) continue;
    if (!/^https?:\/\//.test(decoded)) continue;
    if (!urls.includes(decoded)) urls.push(decoded);
    if (urls.length >= MAX_CANDIDATES_PER_QUERY) break;
  }
  return urls;
}

async function discoverCounty(county: string): Promise<CountyDiscovery> {
  const queries = [
    `${county} County Florida building permit portal`,
    `${county} County FL permit search`,
    `${county} county accela permit`,
    `${county} county trakit permit`
  ];

  const candidateMap = new Map<string, Candidate>();
  for (const query of queries) {
    const urls = await searchDuckDuckGo(query);
    for (const url of urls) {
      const score = scoreUrl(url, county);
      const existing = candidateMap.get(url);
      if (existing) {
        existing.score = Math.max(existing.score, score);
      } else {
        candidateMap.set(url, { url, sourceQuery: query, score });
      }
    }
  }

  const candidates = Array.from(candidateMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_COUNTY);

  return { county, queries, candidates, selected: candidates[0]?.url };
}

async function main(): Promise<void> {
  const results: CountyDiscovery[] = [];
  for (const county of FLORIDA_COUNTIES) {
    const discovered = await discoverCounty(county);
    results.push(discovered);
  }

  process.stdout.write(
    `${JSON.stringify(
      { generatedAt: new Date().toISOString(), countyCount: results.length, results },
      null,
      2
    )}\n`
  );
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("County portal discovery failed", error);
  process.exit(1);
});

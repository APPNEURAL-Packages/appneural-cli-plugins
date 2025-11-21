type RegistryObject = {
  package: { name: string; version: string; description?: string; date?: string };
  score: { final: number };
};

type RegistrySearchResponse = {
  objects: RegistryObject[];
};

export interface MarketplacePlugin {
  name: string;
  version: string;
  description?: string;
  score?: number;
}

const REGISTRY_URL = "https://registry.npmjs.org/-/v1/search";
const QUERY_BASE = "keywords:appneural plugin";

export async function fetchTrending(): Promise<MarketplacePlugin[]> {
  const results = await searchRegistry(QUERY_BASE, 10);
  return results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
}

export async function fetchFeatured(): Promise<MarketplacePlugin[]> {
  const results = await searchRegistry(`${QUERY_BASE} featured`, 10);
  return results.slice(0, 5);
}

export async function fetchRecommended(): Promise<MarketplacePlugin[]> {
  const results = await searchRegistry(`${QUERY_BASE} recommended`, 10);
  return results.slice(0, 5);
}

export async function searchRegistry(keyword: string, size = 15): Promise<MarketplacePlugin[]> {
  const url = new URL(REGISTRY_URL);
  url.searchParams.set("text", keyword);
  url.searchParams.set("size", size.toString());

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Registry responded with ${response.status}`);
  }

  const json = (await response.json()) as RegistrySearchResponse;
  return json.objects.map((obj) => ({
    name: obj.package.name,
    version: obj.package.version,
    description: obj.package.description,
    score: obj.score.final,
  }));
}

export function compareSemver(a: string, b: string): number {
  const pa = normalize(a);
  const pb = normalize(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function normalize(version: string): number[] {
  return version
    .replace(/[^\d.]/g, "")
    .split(".")
    .map((part) => parseInt(part, 10) || 0);
}

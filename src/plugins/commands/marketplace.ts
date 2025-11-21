import { renderTable, withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";
import { fetchFeatured, fetchRecommended, fetchTrending, searchRegistry } from "../marketplace/client.js";

export async function handleMarketplace() {
  const trending = await withSpinner("Fetching trending plugins", () => fetchTrending());
  const featured = await withSpinner("Fetching featured plugins", () => fetchFeatured());
  const recommended = await withSpinner("Fetching recommended plugins", () => fetchRecommended());

  log.info("Trending");
  renderTable(
    ["Name", "Version", "Score", "Description"],
    trending.map((p) => [p.name, p.version, p.score?.toFixed(2) ?? "-", p.description ?? ""]),
  );

  log.info("Featured");
  renderTable(
    ["Name", "Version", "Score", "Description"],
    featured.map((p) => [p.name, p.version, p.score?.toFixed(2) ?? "-", p.description ?? ""]),
  );

  log.info("Recommended");
  renderTable(
    ["Name", "Version", "Score", "Description"],
    recommended.map((p) => [p.name, p.version, p.score?.toFixed(2) ?? "-", p.description ?? ""]),
  );
}

export async function handleMarketplaceSearch(keyword: string) {
  const results = await withSpinner(`Searching for ${keyword}`, () => searchRegistry(keyword));
  if (!results.length) {
    log.info(`No plugins matched "${keyword}".`);
    return;
  }
  renderTable(
    ["Name", "Version", "Score", "Description"],
    results.map((p) => [p.name, p.version, p.score?.toFixed(2) ?? "-", p.description ?? ""]),
  );
}

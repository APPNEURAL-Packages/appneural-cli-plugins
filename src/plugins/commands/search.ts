import chalk from "chalk";
import { renderTable, withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

interface NpmSearchResult {
  objects: Array<{
    package: { name: string; version: string; description?: string; date?: string };
    score: { final: number };
  }>;
}

export async function handleSearch(keyword: string) {
  const url = new URL("https://registry.npmjs.org/-/v1/search");
  url.searchParams.set("text", keyword);
  url.searchParams.set("size", "10");

  try {
    const results = await withSpinner("Searching npm registry", async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Registry responded with ${response.status}`);
      }
      return (await response.json()) as NpmSearchResult;
    });

    if (!results.objects.length) {
      log.info(`No plugins matched "${keyword}".`);
      return;
    }

    renderTable(
      ["Name", "Version", "Score", "Description"],
      results.objects.map((obj) => [
        chalk.bold(obj.package.name),
        obj.package.version,
        obj.score.final.toFixed(2),
        obj.package.description ?? "",
      ]),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
  }
}

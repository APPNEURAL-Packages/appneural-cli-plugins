import chalk from "chalk";
import { renderTable } from "../utils/cli.js";
import { log } from "../utils/logger.js";

const categoryCatalog = [
  { name: "ai", description: "AI assistants and automation", plugins: ["@appneural/plugin-ai"] },
  { name: "devtools", description: "Developer productivity", plugins: ["@appneural/plugin-devtools"] },
  { name: "data", description: "Data processing and analytics", plugins: ["@appneural/plugin-data"] },
];

export function handleCategories() {
  renderTable(
    ["Category", "Description"],
    categoryCatalog.map((c) => [chalk.bold(c.name), c.description]),
  );
}

export function handleCategoryList() {
  log.info("Available categories:");
  categoryCatalog.forEach((cat) => {
    console.log(`${chalk.bold(cat.name)} (${cat.plugins.length})`);
  });
}

export function handleCategoryInfo(category: string) {
  const cat = categoryCatalog.find((c) => c.name === category);
  if (!cat) {
    log.warn(`Category ${category} not found.`);
    return;
  }
  console.log(`${chalk.bold(cat.name)}: ${cat.description}`);
}

export function handleCategoryPlugins(category: string) {
  const cat = categoryCatalog.find((c) => c.name === category);
  if (!cat) {
    log.warn(`Category ${category} not found.`);
    return;
  }
  renderTable(["Plugins"], cat.plugins.map((p) => [p]));
}

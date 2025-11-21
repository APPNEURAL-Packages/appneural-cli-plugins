import path from "node:path";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";
import { generateComponent, generatePluginBase } from "../generator/index.js";

type GenerateType = "tool" | "command" | "app" | "template" | "engine" | "sdk" | "agent";

export async function handleGenerate(type: GenerateType, name: string, options: { plugin?: string }) {
  if (!options.plugin) {
    log.warn("Use --plugin to target a plugin.");
    return;
  }
  const pluginRoot = path.resolve(options.plugin);
  const pluginName = path.basename(pluginRoot);

  await withSpinner(`Preparing plugin ${pluginName}`, async () => {
    await generatePluginBase(pluginRoot, pluginName);
  });

  await withSpinner(`Generating ${type} ${name}`, async () => {
    await generateComponent(pluginRoot, type, name);
  });
}

import path from "node:path";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";
import { writeJSON, ensureDir } from "../utils/fs.js";

export async function handleCreate(pluginName: string, options: { dir?: string }) {
  const target = options.dir ? path.resolve(options.dir) : path.join(process.cwd(), pluginName);
  await withSpinner(`Scaffolding ${pluginName}`, async () => {
    await ensureDir(target);
    await writeJSON(path.join(target, "package.json"), {
      name: pluginName,
      version: "0.1.0",
      type: "module",
      main: "./index.js",
      appneuralPlugin: {
        name: pluginName,
        version: "0.1.0",
        commands: [],
        tools: [],
        apps: [],
        templates: [],
        engines: [],
        agents: [],
        hooks: {},
      },
    });
  });
  log.success(`Created plugin scaffold at ${target}`);
}

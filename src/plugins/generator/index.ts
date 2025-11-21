import path from "node:path";
import { writeFile } from "node:fs/promises";
import { ensureDir, pathExists, writeJSON, readJSON } from "../utils/fs.js";
import { log } from "../utils/logger.js";

type ComponentType = "command" | "tool" | "app" | "template" | "engine" | "agent" | "sdk";

interface ComponentEntry {
  name: string;
  description?: string;
}

interface ScaffoldManifest {
  name: string;
  version: string;
  description?: string;
  commands: ComponentEntry[];
  tools: ComponentEntry[];
  apps: ComponentEntry[];
  templates: ComponentEntry[];
  engines: ComponentEntry[];
  agents: ComponentEntry[];
  sdks: ComponentEntry[];
}

const COMPONENT_DIRS: Record<ComponentType, string> = {
  command: "commands",
  tool: "tools",
  app: "apps",
  template: "templates",
  engine: "engines",
  agent: "agents",
  sdk: "sdks",
};

export async function generatePluginBase(pluginRoot: string, pluginName: string) {
  await ensureDir(pluginRoot);
  await ensureDir(path.join(pluginRoot, "src"));
  await Promise.all(
    Object.values(COMPONENT_DIRS).map((dir) => ensureDir(path.join(pluginRoot, "src", dir))),
  );

  const pkgPath = path.join(pluginRoot, "package.json");
  if (!(await pathExists(pkgPath))) {
    await writeJSON(pkgPath, {
      name: pluginName,
      version: "0.1.0",
      type: "module",
      main: "dist/index.js",
      types: "dist/index.d.ts",
      scripts: {
        build: "tsc -p tsconfig.json",
        dev: "tsc -w -p tsconfig.json",
        prepublishOnly: "npm run build",
      },
      peerDependencies: {
        "@appneural/cli": "*",
      },
      dependencies: {
        commander: "^12.0.0",
        chalk: "^5.0.0",
      },
    });
  }

  const tsconfigPath = path.join(pluginRoot, "tsconfig.json");
  if (!(await pathExists(tsconfigPath))) {
    await writeJSON(tsconfigPath, {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        esModuleInterop: true,
        declaration: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    });
  }

  const srcIndex = path.join(pluginRoot, "src", "index.ts");
  if (!(await pathExists(srcIndex))) {
    const indexContent = [
      'import { Command } from "commander";',
      'import manifest from "../appneural.plugin.mjs";',
      "",
      "// Plugin entrypoint; commands/tools are auto-registered by anx at runtime.",
      "export default {",
      "  ...manifest,",
      "  install(_cli: Command) {",
      "    // Add custom bootstrapping here if required",
      "  },",
      "};",
      "",
    ].join("\n");
    await writeFile(srcIndex, indexContent, "utf8");
  }

  const defaultManifest = await readManifest(pluginRoot, pluginName);
  await writeManifest(pluginRoot, defaultManifest);
}

export async function generateComponent(pluginRoot: string, type: ComponentType, name: string) {
  const manifest = await readManifest(pluginRoot, name);
  const dir = COMPONENT_DIRS[type];
  const targetDir = path.join(pluginRoot, "src", dir);
  await ensureDir(targetDir);
  const filePath = path.join(targetDir, `${name}.ts`);
  const description = `Generated ${type} ${name}`;

  if (!(await pathExists(filePath))) {
    await writeFile(filePath, buildComponentStub(type, name), "utf8");
  }

  const manifestsArray = manifestField(manifest, type);
  if (!manifestsArray.some((entry) => entry.name === name)) {
    manifestsArray.push({ name, description });
  }

  await writeManifest(pluginRoot, manifest);
  log.success(`Generated ${type} "${name}" in ${filePath}`);
}

async function readManifest(pluginRoot: string, pluginName: string): Promise<ScaffoldManifest> {
  const manifestPath = path.join(pluginRoot, "plugin.json");
  if (await pathExists(manifestPath)) {
    const manifest = await readJSON<ScaffoldManifest>(manifestPath, defaultManifest(pluginName));
    return normalizeManifest(manifest, pluginName);
  }
  return defaultManifest(pluginName);
}

async function writeManifest(pluginRoot: string, manifest: ScaffoldManifest) {
  const manifestPath = path.join(pluginRoot, "plugin.json");
  await writeJSON(manifestPath, manifest);
  const modulePath = path.join(pluginRoot, "appneural.plugin.mjs");
  await writeFile(modulePath, buildManifestModule(manifest), "utf8");
}

function manifestField(manifest: ScaffoldManifest, type: ComponentType): ComponentEntry[] {
  switch (type) {
    case "command":
      return manifest.commands;
    case "tool":
      return manifest.tools;
    case "app":
      return manifest.apps;
    case "template":
      return manifest.templates;
    case "engine":
      return manifest.engines;
    case "agent":
      return manifest.agents;
    case "sdk":
      return manifest.sdks;
    default:
      return manifest.commands;
  }
}

function defaultManifest(pluginName: string): ScaffoldManifest {
  return {
    name: pluginName,
    version: "0.1.0",
    description: `${pluginName} plugin`,
    commands: [],
    tools: [],
    apps: [],
    templates: [],
    engines: [],
    agents: [],
    sdks: [],
  };
}

function normalizeManifest(manifest: ScaffoldManifest, pluginName: string): ScaffoldManifest {
  return {
    ...manifest,
    name: manifest.name ?? pluginName,
    version: manifest.version ?? "0.1.0",
    commands: manifest.commands ?? [],
    tools: manifest.tools ?? [],
    apps: manifest.apps ?? [],
    templates: manifest.templates ?? [],
    engines: manifest.engines ?? [],
    agents: manifest.agents ?? [],
    sdks: manifest.sdks ?? [],
  };
}

function buildComponentStub(type: ComponentType, name: string): string {
  const header = "// Auto-generated by anx plugin generator";
  const logLine = `console.log(\`[${name}] ${type} executed\`);`;

  const map: Record<ComponentType, string> = {
    command: `${header}
export default async function run(args: string[] = [], _context: any) {
  ${logLine}
  if (args.length) {
    console.log("Args:", args.join(" "));
  }
}
`,
    tool: `${header}
export default async function run(_context: any) {
  ${logLine}
}
`,
    app: `${header}
export default async function run(_context: any) {
  ${logLine}
}
`,
    template: `${header}
export default async function generate(_context: any) {
  ${logLine}
}
`,
    engine: `${header}
export default async function execute(_context: any) {
  ${logLine}
}
`,
    agent: `${header}
export default async function run(_context: any) {
  ${logLine}
}
`,
    sdk: `${header}
export default async function createClient() {
  ${logLine}
  return {};
}
`,
  };

  return map[type];
}

function buildManifestModule(manifest: ScaffoldManifest): string {
  const stringifyEntries = (type: ComponentType, entries: ComponentEntry[]) =>
    entries
      .map(
        (item) => `{
      name: "${item.name}",
      description: ${item.description ? `"${item.description}"` : '""'},
      ${type === "command" ? "action" : type === "tool" ? "handler" : type === "app" ? "run" : type === "template" ? "generate" : type === "engine" ? "execute" : type === "agent" ? "run" : "create"}: async (...args) => {
        const mod = await loadModule([
          "./dist/${COMPONENT_DIRS[type]}/${item.name}.js",
          "./src/${COMPONENT_DIRS[type]}/${item.name}.js",
        ]);
        const fn = mod?.default ?? mod?.run ?? mod?.handler ?? mod?.generate ?? mod?.execute ?? mod?.createClient;
        if (fn) return fn(...args);
      },
    }`,
      )
      .join(",\n");

  const content = `// Auto-generated manifest. Do not edit manually.
async function loadModule(paths) {
  for (const p of paths) {
    try {
      return await import(p);
    } catch (error) {
      if (error && (error.code === "ERR_MODULE_NOT_FOUND" || error.code === "MODULE_NOT_FOUND")) {
        continue;
      }
      throw error;
    }
  }
  return null;
}

const manifest = {
  name: "${manifest.name}",
  version: "${manifest.version}",
  description: ${manifest.description ? `"${manifest.description}"` : '""'},
  commands: [${stringifyEntries("command", manifest.commands)}],
  tools: [${stringifyEntries("tool", manifest.tools)}],
  apps: [${stringifyEntries("app", manifest.apps)}],
  templates: [${stringifyEntries("template", manifest.templates)}],
  engines: [${stringifyEntries("engine", manifest.engines)}],
  agents: [${stringifyEntries("agent", manifest.agents)}],
  sdks: [${stringifyEntries("sdk", manifest.sdks)}],
  hooks: {},
  permissions: [],
};

export default manifest;
`;

  return content;
}

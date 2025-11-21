import AjvImport from "ajv";
import addFormats from "ajv-formats";
import { ManifestValidationError } from "../utils/errors.js";
import { PluginManifest } from "../utils/types.js";
import { pluginManifestSchema } from "./schema.js";

const Ajv = (AjvImport as any).default ?? AjvImport;
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
(addFormats as any)(ajv);
const validate = ajv.compile(pluginManifestSchema as any);

export function validateManifest(manifest: Partial<PluginManifest>, source = "plugin"): PluginManifest {
  const errors: string[] = [];

  if (!manifest.name || typeof manifest.name !== "string") {
    errors.push('Missing or invalid "name".');
  }

  if (!manifest.version || typeof manifest.version !== "string") {
    errors.push('Missing or invalid "version".');
  }

  if (manifest.category && typeof manifest.category !== "string") {
    errors.push('"category" must be a string.');
  }

  const arrays: Array<[keyof PluginManifest, unknown]> = [
    ["commands", manifest.commands],
    ["tools", manifest.tools],
    ["apps", manifest.apps],
    ["templates", manifest.templates],
    ["engines", manifest.engines],
    ["agents", manifest.agents],
    ["sdks", manifest.sdks],
  ];

  for (const [key, value] of arrays) {
    if (value !== undefined && !Array.isArray(value)) {
      errors.push(`"${String(key)}" must be an array.`);
    }
  }

  if (manifest.hooks && typeof manifest.hooks !== "object") {
    errors.push('"hooks" must be an object.');
  } else if (manifest.hooks) {
    const { onLoad, onRegister, onRun, onCommandRun } = manifest.hooks as Record<string, unknown>;
    const hooks = { onLoad, onRegister, onRun, onCommandRun };
    for (const [hook, fn] of Object.entries(hooks)) {
      if (fn !== undefined && typeof fn !== "function") {
        errors.push(`Hook "${hook}" must be a function.`);
      }
    }
  }

  if (errors.length) {
    throw new ManifestValidationError(`Invalid manifest (${source}): ${errors.join(" ")}`);
  }

  if (!validate(manifest)) {
    const ajvErrors = validate.errors ?? [];
    const formatted = ajvErrors
      .map((err: any) => `${(err.instancePath || "/") as string} ${(err.message ?? "") as string}`.trim())
      .join(" ; ");
    throw new ManifestValidationError(`Schema validation failed (${source}): ${formatted}`);
  }

  const normalized: PluginManifest = {
    name: manifest.name as string,
    version: manifest.version as string,
    description: manifest.description ?? "",
    category: manifest.category,
    commands: manifest.commands ?? [],
    tools: manifest.tools ?? [],
    apps: manifest.apps ?? [],
    templates: manifest.templates ?? [],
    engines: manifest.engines ?? [],
    agents: manifest.agents ?? [],
    sdks: manifest.sdks ?? [],
    hooks: manifest.hooks ?? {},
    permissions: manifest.permissions ?? [],
  };

  return normalized;
}

export type PluginHookName = "onLoad" | "onRegister" | "onRun" | "onCommandRun";

export type PluginPermission =
  | "fs:read"
  | "fs:write"
  | "network"
  | "process:exec"
  | "sandbox:escape";

export interface PluginCommandSpec {
  name: string;
  description?: string;
  options?: Array<{ flags: string; description?: string; defaultValue?: unknown }>;
  action?: (args: string[], context: PluginRuntimeContext) => Promise<void> | void;
  alias?: string;
}

export interface PluginToolSpec {
  name: string;
  description?: string;
  handler?: (context: PluginRuntimeContext) => Promise<void> | void;
  examples?: string[];
}

export interface PluginAppSpec {
  name: string;
  description?: string;
  run?: (context: PluginRuntimeContext) => Promise<void> | void;
}

export interface PluginTemplateSpec {
  name: string;
  description?: string;
  generate?: (context: PluginRuntimeContext) => Promise<void> | void;
}

export interface PluginEngineSpec {
  name: string;
  description?: string;
  execute?: (context: PluginRuntimeContext) => Promise<void> | void;
}

export interface PluginAgentSpec {
  name: string;
  description?: string;
  run?: (context: PluginRuntimeContext) => Promise<void> | void;
}

export interface PluginSdkSpec {
  name: string;
  description?: string;
  create?: (context: PluginRuntimeContext) => Promise<unknown> | unknown;
}

export interface PluginHooks {
  onLoad?: (context: PluginRuntimeContext) => Promise<void> | void;
  onRegister?: (context: PluginRuntimeContext) => Promise<void> | void;
  onRun?: (context: PluginRuntimeContext) => Promise<void> | void;
  onCommandRun?: (context: PluginRuntimeContext & { commandName?: string }) => Promise<void> | void;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  category?: string;
  commands?: PluginCommandSpec[];
  tools?: PluginToolSpec[];
  apps?: PluginAppSpec[];
  templates?: PluginTemplateSpec[];
  engines?: PluginEngineSpec[];
  agents?: PluginAgentSpec[];
  sdks?: PluginSdkSpec[];
  hooks?: PluginHooks;
  permissions?: PluginPermission[];
}

export interface PluginRuntimeContext {
  cwd: string;
  manifest: PluginManifest;
  sandboxed: boolean;
  permissions: PluginPermission[];
  meta?: Record<string, unknown>;
}

export type PluginSource = "local" | "global" | "linked" | "workspace";

export interface RegistryRecord {
  name: string;
  version: string;
  location: string;
  enabled: boolean;
  source: PluginSource;
  manifest: PluginManifest;
  linked?: boolean;
  lastChecked?: number;
}

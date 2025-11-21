import type { Command } from "commander";
import { registerPluginCLI } from "./commands/plugins.js";
export * from "./plugins/index.js";
export { registerPluginCLI } from "./commands/plugins.js";

export default function register(program: Command): void {
  registerPluginCLI(program);
}

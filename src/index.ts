import { Command } from "commander";
import { registerPluginsCommands } from "./commands/plugins.js";

export default function register(program: Command): void {
  registerPluginsCommands(program);
}

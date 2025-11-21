import { Command } from "commander";
import { registerPluginCLI } from "./commands/plugins.js";

const program = new Command();
program.name("anx").description("AppNeural CLI with plugin support").version("0.1.15");

await registerPluginCLI(program);

await program.parseAsync(process.argv);

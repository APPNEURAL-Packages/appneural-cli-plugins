import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { execa } from "execa";
import chalk from "chalk";

export function registerPluginCreateCommand(program: Command): void {
  program
    .command("create <pluginName>")
    .description("Create a new APPNEURAL plugin locally")
    .action(async (pluginName: string) => {
      try {
        pluginName = pluginName.trim();
        const DIR_NAME = `appneural-plugin-${pluginName}`;
        const DESCRIPTION = `plugin-${pluginName} plugin for APPNEURAL CLI`;

        const pluginPath = path.resolve(DIR_NAME);
        const srcPath = path.join(pluginPath, "src");
        const srcCommandsPath = path.join(pluginPath, "src/commands");

        // --------------------------
        // Create required directories
        // --------------------------
        await fs.mkdir(srcCommandsPath, { recursive: true });

        // --------------------------
        // package.json
        // --------------------------
        const packageJson = {
          name: `@appneural/plugin-${pluginName}`,
          version: "0.0.1",
          main: "dist/index.js",
          types: "dist/index.d.ts",
          type: "module",
          scripts: {
            build: "tsc -p tsconfig.json",
            dev: "tsc -w -p tsconfig.json",
            prepublishOnly: "npm run build"
          },
          peerDependencies: {
            "@appneural/cli": "*"
          },
          dependencies: {
            commander: "^12.0.0",
            chalk: "^5.0.0"
          },
          publishConfig: {
            access: "public"
          },
          description: DESCRIPTION,
          keywords: ["appneural", ..."plugin-" + pluginName.split('-')],
          author: "APPNEURAL",
          license: "MIT",
          files: ["dist", "README.md"],
          devDependencies: {
            "@types/node": "^24.10.1",
            "typescript": "^5.9.3"
          }
        };

        await fs.writeFile(
          path.join(pluginPath, "package.json"),
          JSON.stringify(packageJson, null, 2)
        );

        // --------------------------
        // tsconfig.json
        // --------------------------
        const tsconfig = {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            esModuleInterop: true,
            declaration: true,
            outDir: "dist",
            rootDir: "src"
          },
          include: ["src"]
        };

        await fs.writeFile(
          path.join(pluginPath, "tsconfig.json"),
          JSON.stringify(tsconfig, null, 2)
        );

        // --------------------------
        // src/index.ts
        // --------------------------
        await fs.writeFile(
          path.join(srcPath, "index.ts"),
          `import { Command } from "commander";
import { registerCommands } from "./commands/index.js";

const plugin = {
  name: "${pluginName}",
  version: "0.1.0",

  install(cli: Command) {
    let toolsCmd = cli.commands.find(cmd => cmd.name() === "tools");
    if (!toolsCmd) toolsCmd = cli.command("tools");

    let cmd = toolsCmd.commands.find(cmd => cmd.name() === "${pluginName}");
    if (!cmd) cmd = toolsCmd.command("${pluginName}");

    registerCommands(cmd, { prefix: "", plugin: "${pluginName}" });
  },
};

export default plugin;
`
        );

        // --------------------------
        // src/commands/index.ts
        // --------------------------
        await fs.writeFile(
          path.join(srcCommandsPath, "index.ts"),
          `import { Command } from "commander";
import chalk from "chalk";

function handleError(error: any) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(chalk.red("[${pluginName}] " + msg));
}

export function registerCommands(cli: Command, _options: { prefix: "", plugin: "${pluginName}" }) {
  cli
    .command("hello <name>")
    .description("Test command for ${pluginName}")
    .action((name) => {
      try {
        console.log(chalk.green(\`Hello, \${name} from ${pluginName}!\`));
      } catch (err) {
        handleError(err);
      }
    });
}
`
        );

        // --------------------------
        // README.md
        // --------------------------
        await fs.writeFile(
          path.join(pluginPath, "README.md"),
          `# @appneural/plugin-${pluginName}

${DESCRIPTION}

## Example Usage

\`\`\bash
an tools ${pluginName} hello Ajay
\`\`\`

## Development

\`\`\bash
npm run dev
npm run build
\`\`\`
`
        );

        // --------------------------
        // .gitignore
        // --------------------------
        await fs.writeFile(
          path.join(pluginPath, ".gitignore"),
          `dist
node_modules
*.log
*.tsbuildinfo
`
        );

        // --------------------------
        // .npmignore
        // --------------------------
        await fs.writeFile(
          path.join(pluginPath, ".npmignore"),
          `src
tsconfig.json
`
        );

        // --------------------------
        // Git init + first commit
        // --------------------------
        console.log(chalk.cyan("⚙️ Initializing Git repository..."));
        await execa("git", ["init"], { cwd: pluginPath });
        await execa("git", ["add", "."], { cwd: pluginPath });
        await execa(
          "git",
          ["commit", "-m", `Initial commit for @appneural/plugin-${pluginName}`],
          { cwd: pluginPath }
        );

        console.log(
          chalk.green(`\n✅ Plugin 'plugin-${pluginName}' created successfully at:\n${pluginPath}\n`)
        );
      } catch (err) {
        console.error(
          chalk.red(`\n❌ Failed to create plugin: ${err instanceof Error ? err.message : err}\n`)
        );
      }
    });
}

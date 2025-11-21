import chalk from "chalk";

export type SpinnerTask<T = void> = () => Promise<T> | T;

export async function withSpinner<T>(text: string, task: SpinnerTask<T>): Promise<T> {
  const spinner = createSpinner(text);
  try {
    spinner.start();
    const result = await task();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export function renderTable(headers: string[], rows: Array<Array<string | number | boolean>>) {
  const widths = headers.map((header, idx) =>
    Math.max(header.length, ...rows.map((row) => String(row[idx] ?? "").length)),
  );

  const formatRow = (row: (string | number | boolean)[]) =>
    row
      .map((cell, idx) => {
        const value = cell === undefined || cell === null ? "" : String(cell);
        return value.padEnd(widths[idx], " ");
      })
      .join("  ");

  console.log(chalk.bold(formatRow(headers)));
  rows.forEach((row) => console.log(formatRow(row)));
}

function createSpinner(text: string) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let timer: NodeJS.Timeout | null = null;
  const render = (frame: string) => process.stdout.write(`\r${frame} ${text}`);

  return {
    start() {
      render(frames[i]);
      timer = setInterval(() => {
        i = (i + 1) % frames.length;
        render(frames[i]);
      }, 80);
    },
    succeed() {
      if (timer) clearInterval(timer);
      process.stdout.write(`\r✔ ${text}\n`);
    },
    fail() {
      if (timer) clearInterval(timer);
      process.stdout.write(`\r${chalk.red("✖")} ${text}\n`);
    },
  };
}

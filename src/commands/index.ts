import chalk from "chalk";
import { Command } from "commander";

const DEFAULT_GST_RATE = 18;
const DEFAULT_LOAN_RATE = 9.5;
type GstOptionValues = { rate?: string; amount?: string };
type LoanOptionValues = { rate?: string; unit?: string };
type CommandVariant = "prefixed" | "shortcut";
const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: "${value}" is not a number.`);
  }

  if (parsed <= 0) {
    throw new Error(`Invalid ${label}: value must be greater than zero.`);
  }

  return parsed;
}

function parsePercentage(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: "${value}" is not a number.`);
  }

  if (parsed < 0) {
    throw new Error(`Invalid ${label}: percentage cannot be negative.`);
  }

  return parsed;
}

function formatAmount(value: number): string {
  return numberFormatter.format(value);
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`[calculators] ${message}`));
  process.exitCode = 1;
}

function registerCalculatorCommand(
  cli: Command,
  prefix: string,
  pattern: string,
  description: string,
  shortcuts: string[],
  configure: (command: Command, variant: CommandVariant) => void,
) {
  // Use a Set to avoid duplicate command patterns
  const patterns = new Set<string>();
  // Only register the main pattern, not shortcuts, to avoid duplicate commands
  if (!cli.commands.some(cmd => cmd.name() === pattern.split(' ')[0])) {
    const command = cli.command(pattern);
    command.description(description);
    configure(command, "prefixed");
  }
}

export function registerCommands(cli: Command, options: { prefix: string; plugin: string }) {
  registerCalculatorCommand(
    cli,
    "",
    "gst [amount]",
    "Calculate GST for a base amount.",
    ["gst [amount]", "gts [amount]"],
    (command) => {
      command
        .option("-a, --amount <amount>", "Base amount to calculate GST for")
        .option("-r, --rate <rate>", "GST percentage to apply", DEFAULT_GST_RATE.toString())
        .action((amount: string | undefined, options: GstOptionValues) => {
          try {
            const amountInput = amount ?? options.amount;
            if (!amountInput) {
              throw new Error("Provide an amount via positional argument or --amount.");
            }

            const baseAmount = parsePositiveNumber(amountInput, "amount");
            const gstRate = parsePercentage(options.rate ?? DEFAULT_GST_RATE.toString(), "rate");

            const gstAmount = (baseAmount * gstRate) / 100;
            const total = baseAmount + gstAmount;

            console.log(chalk.bold("GST Breakdown"));
            console.log(`${chalk.gray("Base Amount".padEnd(18))}: ${formatAmount(baseAmount)}`);
            console.log(`${chalk.gray(`GST (${gstRate}%)`.padEnd(18))}: ${formatAmount(gstAmount)}`);
            console.log(`${chalk.gray("Total".padEnd(18))}: ${chalk.green(formatAmount(total))}`);
          } catch (error) {
            handleError(error);
          }
        });
    },
  );

  registerCalculatorCommand(
    cli,
    "",
    "loan <principal> <term> [rate]",
    "Estimate loan EMI breakdown. Term is in months by default.",
    ["loan <principal> <term> [rate]"],
    (command) => {
      command
        .option("-u, --unit <unit>", `Term unit ("months" | "years")`, "months")
        .action((principal: string, term: string, rate: string | undefined, options: LoanOptionValues) => {
          try {
            const loanPrincipal = parsePositiveNumber(principal, "principal");
            const termValue = parsePositiveNumber(term, "term");
            const annualRate = parsePercentage(rate ?? options.rate ?? DEFAULT_LOAN_RATE.toString(), "rate");

            const termUnit = (options.unit ?? "months").toLowerCase();
            const totalMonths = termUnit.startsWith("year") ? termValue * 12 : termValue;
            const roundedMonths = Math.round(totalMonths);
            if (Math.abs(roundedMonths - totalMonths) > 0.0001) {
              console.warn(chalk.yellow("Term value was rounded to the nearest whole month."));
            }

            if (roundedMonths <= 0) {
              throw new Error("Loan term must be at least 1 month.");
            }

            const monthlyRate = annualRate / 12 / 100;

            const emi =
              monthlyRate === 0
                ? loanPrincipal / roundedMonths
                : (loanPrincipal * monthlyRate * Math.pow(1 + monthlyRate, roundedMonths)) /
                  (Math.pow(1 + monthlyRate, roundedMonths) - 1);

            const totalPayment = emi * roundedMonths;
            const interestPaid = totalPayment - loanPrincipal;

            console.log(chalk.bold("Loan EMI Estimate"));
            console.log(`${chalk.gray("Principal".padEnd(18))}: ${formatAmount(loanPrincipal)}`);
            console.log(`${chalk.gray("Rate (annual)".padEnd(18))}: ${annualRate.toFixed(2)}%`);
            console.log(`${chalk.gray("Term".padEnd(18))}: ${roundedMonths} months`);
            console.log(`${chalk.gray("Monthly EMI".padEnd(18))}: ${chalk.green(formatAmount(emi))}`);
            console.log(`${chalk.gray("Total Interest".padEnd(18))}: ${formatAmount(interestPaid)}`);
            console.log(`${chalk.gray("Total Paid".padEnd(18))}: ${formatAmount(totalPayment)}`);
          } catch (error) {
            handleError(error);
          }
        });
    },
  );

  registerCalculatorCommand(
    cli,
    "",
    "discount <price> <percent>",
    "Compute effective price after discount.",
    ["discount <price> <percent>"],
    (command) => {
      command.action((price: string, percent: string) => {
        try {
          const basePrice = parsePositiveNumber(price, "price");
          const discountPercent = parsePercentage(percent, "percent");

          if (discountPercent >= 100) {
            throw new Error("Discount percent must be less than 100.");
          }

          const discountAmount = (basePrice * discountPercent) / 100;
          const finalPrice = basePrice - discountAmount;

          console.log(chalk.bold("Discount Calculation"));
          console.log(`${chalk.gray("Original Price".padEnd(18))}: ${formatAmount(basePrice)}`);
          console.log(`${chalk.gray(`Discount (${discountPercent}%)`.padEnd(18))}: -${formatAmount(discountAmount)}`);
          console.log(`${chalk.gray("Final Price".padEnd(18))}: ${chalk.green(formatAmount(finalPrice))}`);
        } catch (error) {
          handleError(error);
        }
      });
    },
  );
}

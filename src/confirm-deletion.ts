import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { Notebook } from "notebooklm-kit";
import { formatPreviewTable } from "./format-table.js";

export const CONFIRMATION_WORD = "delete";

export function isDeletionConfirmed(input: string): boolean {
  return input.trim().toLowerCase() === CONFIRMATION_WORD;
}

export interface ConfirmDeletionOptions {
  input?: Readable;
  output?: Writable;
  write?: (message: string) => void;
  question?: (prompt: string) => Promise<string>;
}

export async function promptForDeletionConfirmation(
  notebooks: Notebook[],
  options: ConfirmDeletionOptions = {},
): Promise<boolean> {
  if (notebooks.length === 0) {
    return false;
  }

  const write = options.write ?? ((message: string) => {
    options.output?.write(`${message}\n`);
  });

  write("");
  write("Notebooks marked for deletion:");
  write(formatPreviewTable(notebooks));

  const prompt = `Type delete to permanently remove these ${notebooks.length} notebooks, or press Enter to cancel: `;
  const answer = options.question
    ? await options.question(prompt)
    : await askQuestion(prompt, options.input, options.output);

  return isDeletionConfirmed(answer);
}

async function askQuestion(
  prompt: string,
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    return await new Promise<string>((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  } finally {
    rl.close();
  }
}

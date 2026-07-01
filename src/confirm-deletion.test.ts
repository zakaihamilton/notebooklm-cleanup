import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  isDeletionConfirmed,
  promptForDeletionConfirmation,
} from "./confirm-deletion.js";

function notebook(projectId: string) {
  return {
    projectId,
    title: projectId,
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("isDeletionConfirmed", () => {
  it.each(["delete", "DELETE", "Delete", "  delete  "])(
    "accepts %s",
    (input) => {
      expect(isDeletionConfirmed(input)).toBe(true);
    },
  );

  it.each(["", "yes", "remove", "deleted"])(
    "rejects %s",
    (input) => {
      expect(isDeletionConfirmed(input)).toBe(false);
    },
  );
});

describe("promptForDeletionConfirmation", () => {
  it("re-displays the formatted notebook table before prompting", async () => {
    const messages: string[] = [];

    await promptForDeletionConfirmation([notebook("alpha")], {
      write: (message) => messages.push(message),
      question: async () => "",
    });

    expect(messages.join("\n")).toContain("Notebooks marked for deletion:");
    expect(messages.join("\n")).toContain("alpha");
    expect(messages.join("\n")).toContain("Updated At");
  });

  it("returns true when the user confirms deletion", async () => {
    const confirmed = await promptForDeletionConfirmation([notebook("alpha")], {
      write: () => {},
      question: async () => "DELETE",
    });

    expect(confirmed).toBe(true);
  });

  it("returns false for empty input", async () => {
    const confirmed = await promptForDeletionConfirmation([notebook("alpha")], {
      write: () => {},
      question: async () => "",
    });

    expect(confirmed).toBe(false);
  });

  it("returns false for non-delete answers", async () => {
    const confirmed = await promptForDeletionConfirmation([notebook("alpha")], {
      write: () => {},
      question: async () => "yes",
    });

    expect(confirmed).toBe(false);
  });

  it("returns false for an empty notebook list without prompting", async () => {
    const question = vi.fn(async () => "delete");

    const confirmed = await promptForDeletionConfirmation([], {
      write: () => {},
      question,
    });

    expect(confirmed).toBe(false);
    expect(question).not.toHaveBeenCalled();
  });

  it("writes to the provided output stream when write is omitted", async () => {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk) => chunks.push(chunk.toString()));

    await promptForDeletionConfirmation([notebook("alpha")], {
      output,
      question: async () => "",
    });

    expect(chunks.join("")).toContain("Notebooks marked for deletion:");
    expect(chunks.join("")).toContain("alpha");
  });

  it("reads confirmation from stdin when question is omitted", async () => {
    const input = new PassThrough();
    const output = new PassThrough();

    const confirmation = promptForDeletionConfirmation([notebook("alpha")], {
      input,
      output,
    });

    input.end("delete\n");

    await expect(confirmation).resolves.toBe(true);
  });
});

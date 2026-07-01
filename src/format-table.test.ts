import { describe, expect, it } from "vitest";
import { formatPreviewTable } from "./format-table.js";

function notebook(
  projectId: string,
  title: string,
  updatedAt?: string,
) {
  return {
    projectId,
    title,
    updatedAt,
  };
}

describe("formatPreviewTable", () => {
  it("renders header, separator, and numbered rows", () => {
    const table = formatPreviewTable([
      notebook("1", "First Notebook", "2024-01-01T00:00:00.000Z"),
      notebook("2", "Second Notebook", "2024-02-01T00:00:00.000Z"),
    ]);

    expect(table).toContain("#   Title");
    expect(table).toContain("Updated At");
    expect(table).toContain("1   First Notebook");
    expect(table).toContain("2   Second Notebook");
    expect(table.split("\n")[1]).toMatch(/^-+$/);
  });

  it("truncates long titles to keep columns aligned", () => {
    const longTitle = "A".repeat(60);
    const table = formatPreviewTable([
      notebook("1", longTitle, "2024-01-01T00:00:00.000Z"),
    ]);

    expect(table).toContain("...");
    expect(table).not.toContain(longTitle);
  });

  it("handles an empty notebook list", () => {
    expect(formatPreviewTable([])).toBe(
      "No notebooks selected for deletion.",
    );
  });

  it("formats ISO timestamps consistently", () => {
    const table = formatPreviewTable([
      notebook("1", "Notebook", "2024-01-15T12:30:00.000Z"),
    ]);

    expect(table).toContain("2024-01-15T12:30:00.000Z");
  });

  it("uses a fallback title when the notebook title is empty", () => {
    const table = formatPreviewTable([
      {
        projectId: "1",
        title: "",
        updatedAt: "2024-01-15T12:30:00.000Z",
      },
    ]);

    expect(table).toContain("(untitled)");
  });
});

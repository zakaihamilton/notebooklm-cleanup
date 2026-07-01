import { describe, expect, it } from "vitest";
import {
  compareNotebooksForDeletion,
  formatNotebookTimestamp,
  getNotebookTimestamp,
  hasNotebookTimestamp,
  selectOldestNotebooks,
} from "./select-notebooks.js";

function notebook(
  projectId: string,
  overrides: {
    title?: string;
    updatedAt?: string;
    lastAccessed?: string;
  } = {},
) {
  return {
    projectId,
    title: overrides.title ?? projectId,
    ...overrides,
  };
}

describe("getNotebookTimestamp", () => {
  it("uses updatedAt when present", () => {
    const value = getNotebookTimestamp(
      notebook("a", { updatedAt: "2024-01-02T00:00:00.000Z" }),
    );

    expect(value).toBe(Date.parse("2024-01-02T00:00:00.000Z"));
  });

  it("falls back to lastAccessed when updatedAt is missing", () => {
    const value = getNotebookTimestamp(
      notebook("a", { lastAccessed: "2024-03-01T00:00:00.000Z" }),
    );

    expect(value).toBe(Date.parse("2024-03-01T00:00:00.000Z"));
  });

  it("treats missing timestamps as epoch zero", () => {
    expect(getNotebookTimestamp(notebook("a"))).toBe(0);
  });

  it("treats invalid timestamps as epoch zero", () => {
    expect(getNotebookTimestamp(notebook("a", { updatedAt: "not-a-date" }))).toBe(
      0,
    );
  });
});

describe("hasNotebookTimestamp", () => {
  it("returns false when no usable timestamp exists", () => {
    expect(hasNotebookTimestamp(notebook("a"))).toBe(false);
    expect(
      hasNotebookTimestamp(notebook("a", { updatedAt: "not-a-date" })),
    ).toBe(false);
  });

  it("returns true when updatedAt or lastAccessed is valid", () => {
    expect(
      hasNotebookTimestamp(notebook("a", { updatedAt: "2024-01-01T00:00:00.000Z" })),
    ).toBe(true);
  });
});

describe("compareNotebooksForDeletion", () => {
  it("sorts undated notebooks alphabetically by title", () => {
    expect(
      compareNotebooksForDeletion(
        notebook("z", { title: "Zebra" }),
        notebook("a", { title: "Alpha" }),
      ),
    ).toBeGreaterThan(0);
  });
});

describe("selectOldestNotebooks", () => {
  it("sorts notebooks oldest-first by updatedAt", () => {
    const result = selectOldestNotebooks([
      notebook("new", { updatedAt: "2024-06-01T00:00:00.000Z" }),
      notebook("old", { updatedAt: "2024-01-01T00:00:00.000Z" }),
      notebook("mid", { updatedAt: "2024-03-01T00:00:00.000Z" }),
    ]);

    expect(result.map((item) => item.projectId)).toEqual(["old", "mid", "new"]);
  });

  it("falls back to lastAccessed when updatedAt is missing", () => {
    const result = selectOldestNotebooks([
      notebook("newer", { lastAccessed: "2024-06-01T00:00:00.000Z" }),
      notebook("older", { lastAccessed: "2024-01-01T00:00:00.000Z" }),
    ]);

    expect(result.map((item) => item.projectId)).toEqual(["older", "newer"]);
  });

  it("sorts undated notebooks alphabetically by title", () => {
    const result = selectOldestNotebooks([
      notebook("z", { title: "Zebra Notebook" }),
      notebook("a", { title: "Alpha Notebook" }),
      notebook("m", { title: "Middle Notebook" }),
    ]);

    expect(result.map((item) => item.title)).toEqual([
      "Alpha Notebook",
      "Middle Notebook",
      "Zebra Notebook",
    ]);
  });

  it("places dated notebooks before undated notebooks", () => {
    const result = selectOldestNotebooks([
      notebook("z", { title: "Zebra" }),
      notebook("dated", { title: "Dated", updatedAt: "2024-06-01T00:00:00.000Z" }),
      notebook("a", { title: "Alpha" }),
    ]);

    expect(result.map((item) => item.projectId)).toEqual(["dated", "a", "z"]);
  });

  it("returns at most 100 notebooks", () => {
    const notebooks = Array.from({ length: 150 }, (_, index) =>
      notebook(`nb-${index}`, {
        updatedAt: new Date(index).toISOString(),
      }),
    );

    expect(selectOldestNotebooks(notebooks)).toHaveLength(100);
  });

  it("returns all notebooks when fewer than 100 exist", () => {
    const notebooks = [
      notebook("a", { updatedAt: "2024-01-01T00:00:00.000Z" }),
      notebook("b", { updatedAt: "2024-02-01T00:00:00.000Z" }),
    ];

    expect(selectOldestNotebooks(notebooks)).toHaveLength(2);
  });

  it("uses title order for equal timestamps", () => {
    const result = selectOldestNotebooks([
      notebook("b", { title: "Beta", updatedAt: "2024-01-01T00:00:00.000Z" }),
      notebook("a", { title: "Alpha", updatedAt: "2024-01-01T00:00:00.000Z" }),
    ]);

    expect(result.map((item) => item.projectId)).toEqual(["a", "b"]);
  });
});

describe("formatNotebookTimestamp", () => {
  it("returns unknown when no timestamp is available", () => {
    expect(formatNotebookTimestamp(notebook("a"))).toBe("unknown");
  });

  it("returns the raw value when parsing fails", () => {
    expect(
      formatNotebookTimestamp(notebook("a", { updatedAt: "not-a-date" })),
    ).toBe("not-a-date");
  });
});

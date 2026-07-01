import type { Notebook } from "notebooklm-kit";
import { formatNotebookTimestamp } from "./select-notebooks.js";

const TITLE_WIDTH = 48;
const TIMESTAMP_WIDTH = 24;

function pad(value: string, width: number): string {
  if (value.length > width) {
    return `${value.slice(0, width - 3)}...`;
  }

  return value.padEnd(width);
}

export function formatPreviewTable(notebooks: Notebook[]): string {
  if (notebooks.length === 0) {
    return "No notebooks selected for deletion.";
  }

  const header = `${pad("#", 4)}${pad("Title", TITLE_WIDTH)}${pad("Updated At", TIMESTAMP_WIDTH)}`;
  const separator = "-".repeat(header.length);
  const rows = notebooks.map((notebook, index) => {
    const number = String(index + 1);
    const title = notebook.title || "(untitled)";
    const timestamp = formatNotebookTimestamp(notebook);

    return `${pad(number, 4)}${pad(title, TITLE_WIDTH)}${pad(timestamp, TIMESTAMP_WIDTH)}`;
  });

  return [header, separator, ...rows].join("\n");
}

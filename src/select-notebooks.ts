import type { Notebook } from "notebooklm-kit";

export const DELETE_LIMIT = 100;

export function getNotebookTimestamp(notebook: Notebook): number {
  const raw = notebook.updatedAt ?? notebook.lastAccessed;
  if (!raw) {
    return 0;
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function hasNotebookTimestamp(notebook: Notebook): boolean {
  const raw = notebook.updatedAt ?? notebook.lastAccessed;
  if (!raw) {
    return false;
  }

  return !Number.isNaN(Date.parse(raw));
}

export function getNotebookTitle(notebook: Notebook): string {
  return notebook.title?.trim() || "(untitled)";
}

function compareNotebookTitles(left: Notebook, right: Notebook): number {
  const titleCompare = getNotebookTitle(left).localeCompare(getNotebookTitle(right));
  if (titleCompare !== 0) {
    return titleCompare;
  }

  return left.projectId.localeCompare(right.projectId);
}

export function compareNotebooksForDeletion(
  left: Notebook,
  right: Notebook,
): number {
  const leftHasDate = hasNotebookTimestamp(left);
  const rightHasDate = hasNotebookTimestamp(right);

  if (leftHasDate && rightHasDate) {
    const delta = getNotebookTimestamp(left) - getNotebookTimestamp(right);
    if (delta !== 0) {
      return delta;
    }

    return compareNotebookTitles(left, right);
  }

  if (leftHasDate) {
    return -1;
  }

  if (rightHasDate) {
    return 1;
  }

  return compareNotebookTitles(left, right);
}

export function selectOldestNotebooks(
  notebooks: Notebook[],
  limit = DELETE_LIMIT,
): Notebook[] {
  return [...notebooks]
    .sort(compareNotebooksForDeletion)
    .slice(0, limit);
}

export function formatNotebookTimestamp(notebook: Notebook): string {
  const raw = notebook.updatedAt ?? notebook.lastAccessed;
  if (!raw) {
    return "unknown";
  }

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return raw;
  }

  return new Date(parsed).toISOString();
}

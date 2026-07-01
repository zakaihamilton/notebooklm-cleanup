import type { DeleteNotebookResult, Notebook } from "notebooklm-kit";
import { promptForDeletionConfirmation } from "./confirm-deletion.js";
import { formatPreviewTable } from "./format-table.js";
import { DELETE_LIMIT, selectOldestNotebooks } from "./select-notebooks.js";

export interface CleanupSdk {
  connect: () => Promise<void>;
  notebooks: {
    list: () => Promise<Notebook[]>;
    delete: (
      notebookIds: string[],
      options: { mode: "parallel" | "sequential" },
    ) => Promise<DeleteNotebookResult>;
  };
  dispose: () => void;
}

export interface CleanupLogger {
  log: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface RunCleanupOptions {
  sdk: CleanupSdk;
  logger?: CleanupLogger;
  confirmDeletion?: (notebooks: Notebook[]) => Promise<boolean>;
  deleteLimit?: number;
}

const defaultLogger: CleanupLogger = {
  log: (message) => console.log(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
};

export async function runCleanup(options: RunCleanupOptions): Promise<void> {
  const logger = options.logger ?? defaultLogger;
  const confirmDeletion =
    options.confirmDeletion ?? promptForDeletionConfirmation;
  const deleteLimit = options.deleteLimit ?? DELETE_LIMIT;
  const { sdk } = options;

  logger.log("[1/7] Connecting to NotebookLM...");
  await sdk.connect();

  logger.log("[2/7] Fetching notebooks...");
  const notebooks = await sdk.notebooks.list();
  logger.log(`Found ${notebooks.length} notebooks.`);

  logger.log(`[3/7] Selecting ${deleteLimit} oldest notebooks...`);
  const toDelete = selectOldestNotebooks(notebooks, deleteLimit);
  logger.log(`Selected ${toDelete.length} notebook(s) for deletion.`);

  if (toDelete.length === 0) {
    logger.log("No notebooks to delete. Exiting.");
    return;
  }

  logger.log("[4/7] Preview (about to delete):");
  logger.log(formatPreviewTable(toDelete));

  logger.warn(
    `[5/7] WARNING: You are about to permanently delete ${toDelete.length} notebook(s). This cannot be undone.`,
  );

  logger.log("[6/7] Awaiting confirmation...");
  const confirmed = await confirmDeletion(toDelete);

  if (!confirmed) {
    logger.log("Deletion cancelled. No notebooks were deleted.");
    return;
  }

  logger.log("[7/7] Deleting...");
  const notebookIds = toDelete.map((notebook) => notebook.projectId);
  const result = await sdk.notebooks.delete(notebookIds, { mode: "parallel" });

  logger.log(`Successfully deleted ${result.count} notebook(s).`);

  if (result.failed && result.failed.length > 0) {
    logger.warn(
      `Failed to delete ${result.failedCount ?? result.failed.length} notebook(s): ${result.failed.join(", ")}`,
    );
  }
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as confirmDeletion from "./confirm-deletion.js";
import type { CleanupLogger, CleanupSdk } from "./run-cleanup.js";
import { runCleanup } from "./run-cleanup.js";

function notebook(
  projectId: string,
  updatedAt: string,
) {
  return {
    projectId,
    title: projectId,
    updatedAt,
  };
}

function createLogger() {
  return {
    log: vi.fn<(message: string) => void>(),
    warn: vi.fn<(message: string) => void>(),
    error: vi.fn<(message: string) => void>(),
  };
}

function createSdk(overrides: Partial<CleanupSdk> = {}): CleanupSdk {
  return {
    connect: vi.fn(async () => {}),
    notebooks: {
      list: vi.fn(async () => [
        notebook("old", "2024-01-01T00:00:00.000Z"),
        notebook("new", "2024-06-01T00:00:00.000Z"),
      ]),
      delete: vi.fn(async (notebookIds) => ({
        deleted: notebookIds,
        count: notebookIds.length,
      })),
    },
    dispose: vi.fn(),
    ...overrides,
  };
}

describe("runCleanup", () => {
  let logger: CleanupLogger;

  beforeEach(() => {
    logger = createLogger();
  });

  it("runs the happy path and deletes the oldest notebooks in parallel", async () => {
    const sdk = createSdk();
    const confirmDeletion = vi.fn(async () => true);

    await runCleanup({
      sdk,
      logger,
      confirmDeletion,
      deleteLimit: 1,
    });

    expect(sdk.connect).toHaveBeenCalledOnce();
    expect(sdk.notebooks.list).toHaveBeenCalledOnce();
    expect(confirmDeletion).toHaveBeenCalledOnce();
    expect(sdk.notebooks.delete).toHaveBeenCalledWith(["old"], {
      mode: "parallel",
    });
    expect(logger.log).toHaveBeenCalledWith(
      "Successfully deleted 1 notebook(s).",
    );
  });

  it("logs preview and warning before confirmation", async () => {
    const sdk = createSdk();

    await runCleanup({
      sdk,
      logger,
      confirmDeletion: vi.fn(async () => false),
      deleteLimit: 1,
    });

    const logMessages = vi.mocked(logger.log).mock.calls.map(([message]) => message);
    expect(logMessages.some((message) => message.includes("Preview"))).toBe(
      true,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "[5/7] WARNING: You are about to permanently delete 1 notebook(s). This cannot be undone.",
    );
  });

  it("skips deletion when confirmation is declined", async () => {
    const sdk = createSdk();

    await runCleanup({
      sdk,
      logger,
      confirmDeletion: vi.fn(async () => false),
      deleteLimit: 1,
    });

    expect(sdk.notebooks.delete).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      "Deletion cancelled. No notebooks were deleted.",
    );
  });

  it("reports partial delete failures without throwing", async () => {
    const sdk = createSdk({
      notebooks: {
        list: vi.fn(async () => [
          notebook("old", "2024-01-01T00:00:00.000Z"),
        ]),
        delete: vi.fn(async () => ({
          deleted: [],
          count: 0,
          failed: ["old"],
          failedCount: 1,
        })),
      },
    });

    await runCleanup({
      sdk,
      logger,
      confirmDeletion: vi.fn(async () => true),
      deleteLimit: 1,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to delete 1 notebook(s): old",
    );
  });

  it("deletes only the available notebooks when fewer than the limit exist", async () => {
    const sdk = createSdk({
      notebooks: {
        list: vi.fn(async () => [
          notebook("only", "2024-01-01T00:00:00.000Z"),
        ]),
        delete: vi.fn(async (notebookIds) => ({
          deleted: notebookIds,
          count: notebookIds.length,
        })),
      },
    });

    await runCleanup({
      sdk,
      logger,
      confirmDeletion: vi.fn(async () => true),
      deleteLimit: 100,
    });

    expect(sdk.notebooks.delete).toHaveBeenCalledWith(["only"], {
      mode: "parallel",
    });
  });

  it("exits early when there are no notebooks to delete", async () => {
    const sdk = createSdk({
      notebooks: {
        list: vi.fn(async () => []),
        delete: vi.fn(),
      },
    });
    const confirmDeletion = vi.fn(async () => true);

    await runCleanup({ sdk, logger, confirmDeletion });

    expect(confirmDeletion).not.toHaveBeenCalled();
    expect(sdk.notebooks.delete).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith("No notebooks to delete. Exiting.");
  });

  it("propagates connect errors to the caller", async () => {
    const sdk = createSdk({
      connect: vi.fn(async () => {
        throw new Error("connect failed");
      }),
    });

    await expect(
      runCleanup({
        sdk,
        logger,
        confirmDeletion: vi.fn(async () => true),
      }),
    ).rejects.toThrow("connect failed");
  });

  it("propagates delete errors to the caller", async () => {
    const sdk = createSdk({
      notebooks: {
        list: vi.fn(async () => [
          notebook("old", "2024-01-01T00:00:00.000Z"),
        ]),
        delete: vi.fn(async () => {
          throw new Error("delete failed");
        }),
      },
    });

    await expect(
      runCleanup({
        sdk,
        logger,
        confirmDeletion: vi.fn(async () => true),
        deleteLimit: 1,
      }),
    ).rejects.toThrow("delete failed");
  });

  it("uses the default logger and confirmation prompt when omitted", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const confirmSpy = vi
      .spyOn(confirmDeletion, "promptForDeletionConfirmation")
      .mockResolvedValue(false);
    const sdk = createSdk();

    await runCleanup({ sdk, deleteLimit: 1 });

    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalledOnce();

    logSpy.mockRestore();
    warnSpy.mockRestore();
    confirmSpy.mockRestore();
  });
});

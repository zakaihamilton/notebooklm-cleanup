import { afterEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import {
  getChromeDebugPort,
  getChromeProfileDir,
  launchChromeForLogin,
  resolveChromeExecutablePath,
  stopChrome,
  waitForDebugPort,
} from "./chrome-launcher.js";

describe("chrome-launcher helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    spawnMock.mockReset();
  });

  it("uses a project-local Chrome profile directory", () => {
    expect(getChromeProfileDir("/tmp/project")).toBe("/tmp/project/.chrome-profile");
  });

  it("defaults to port 9222 for Chrome remote debugging", () => {
    expect(getChromeDebugPort()).toBe(9222);
  });

  it("uses CHROME_DEBUG_PORT when provided", () => {
    vi.stubEnv("CHROME_DEBUG_PORT", "9444");
    expect(getChromeDebugPort()).toBe(9444);
  });

  it("uses CHROME_PATH when provided", async () => {
    vi.stubEnv("CHROME_PATH", "/custom/chrome");
    await expect(resolveChromeExecutablePath()).resolves.toBe("/custom/chrome");
  });
});

describe("waitForDebugPort", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resolves once Chrome exposes its debug endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true })),
    );

    await expect(waitForDebugPort(9222, 1000)).resolves.toBeUndefined();
  });

  it("retries when the debug endpoint is not ready yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("not ready"))
        .mockResolvedValueOnce({ ok: true }),
    );

    await expect(waitForDebugPort(9222, 1000)).resolves.toBeUndefined();
  });

  it("throws when Chrome never becomes ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );

    await expect(waitForDebugPort(9222, 50)).rejects.toThrow(
      "Timed out waiting for Chrome on debug port 9222",
    );
  });
});

describe("launchChromeForLogin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    spawnMock.mockReset();
  });

  it("spawns Chrome with a dedicated profile and debug port", async () => {
    const kill = vi.fn();
    spawnMock.mockReturnValue({
      killed: false,
      exitCode: null,
      kill,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true })),
    );

    const session = await launchChromeForLogin({
      profileDir: "/tmp/profile",
      debugPort: 9333,
      chromePath: "/custom/chrome",
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "/custom/chrome",
      expect.arrayContaining([
        "--user-data-dir=/tmp/profile",
        "--remote-debugging-port=9333",
        "https://notebooklm.google.com/",
      ]),
      expect.any(Object),
    );
    expect(session.debugPort).toBe(9333);
    expect(session.profileDir).toBe("/tmp/profile");

    stopChrome(session);
    expect(kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("does not kill Chrome when the process already exited", () => {
    const kill = vi.fn();

    stopChrome({
      process: {
        killed: true,
        exitCode: 0,
        kill,
      } as never,
      debugPort: 9222,
      profileDir: "/tmp/profile",
    });

    expect(kill).not.toHaveBeenCalled();
  });
});

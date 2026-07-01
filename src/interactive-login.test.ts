import { beforeEach, describe, expect, it, vi } from "vitest";

const { connectOverCDPMock, saveCredentialsMock } = vi.hoisted(() => ({
  connectOverCDPMock: vi.fn(),
  saveCredentialsMock: vi.fn(async () => {}),
}));

vi.mock("playwright", () => ({
  chromium: {
    connectOverCDP: connectOverCDPMock,
  },
}));

vi.mock("notebooklm-kit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("notebooklm-kit")>();
  return {
    ...actual,
    saveCredentials: saveCredentialsMock,
  };
});

import {
  findNotebookLMPage,
  interactiveBrowserLogin,
  waitForNotebookLMSession,
} from "./interactive-login.js";

const validCookies = `SAPISID=${"x".repeat(50)}; SID=${"y".repeat(50)}`;

function createMockPage({
  url = "https://notebooklm.google.com/",
  authToken = "auth-token",
  documentCookies = "SID=abc",
  contextCookies = [
    { name: "SAPISID", value: "x".repeat(50), domain: ".google.com" },
    { name: "SID", value: "y".repeat(50), domain: ".google.com" },
  ],
  waitForTimeout = vi.fn(async () => {}),
}: {
  url?: string;
  authToken?: string | null;
  documentCookies?: string;
  contextCookies?: Array<{ name: string; value: string; domain?: string }>;
  waitForTimeout?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    url: vi.fn(() => url),
    goto: vi.fn(async () => {}),
    waitForTimeout,
    waitForLoadState: vi.fn(async () => {}),
    evaluate: vi.fn(async (fn: () => unknown) => {
      const source = fn.toString();
      if (source.includes("document.cookie")) {
        return documentCookies;
      }

      return authToken;
    }),
    context: vi.fn(() => ({
      cookies: vi.fn(async () => contextCookies),
    })),
  };
}

describe("interactiveBrowserLogin", () => {
  beforeEach(() => {
    connectOverCDPMock.mockReset();
    saveCredentialsMock.mockClear();
  });

  it("connects to real Chrome over CDP, saves credentials, and closes the session", async () => {
    const page = createMockPage();
    const close = vi.fn(async () => {});
    const stopChromeSession = vi.fn();
    const launchChrome = vi.fn(async () => ({
      process: { kill: vi.fn() },
      debugPort: 9222,
      profileDir: "/tmp/.chrome-profile",
    }));
    const validateCredentials = vi.fn(async () => {});

    connectOverCDPMock.mockResolvedValue({
      contexts: () => [
        {
          pages: () => [page],
        },
      ],
      close,
    });

    const logs: string[] = [];
    const credentials = await interactiveBrowserLogin(
      { log: (message) => logs.push(message) },
      {
        launchChrome,
        connectOverCDP: connectOverCDPMock,
        stopChromeSession,
        validateCredentials,
      },
    );

    expect(launchChrome).toHaveBeenCalledOnce();
    expect(connectOverCDPMock).toHaveBeenCalledWith(9222);
    expect(validateCredentials).toHaveBeenCalled();
    expect(credentials).toEqual({
      authToken: "auth-token",
      cookies: expect.stringContaining("SAPISID="),
    });
    expect(saveCredentialsMock).toHaveBeenCalledWith(credentials);
    expect(close).toHaveBeenCalledOnce();
    expect(stopChromeSession).toHaveBeenCalledOnce();
    expect(logs.some((message) => message.includes("Google Chrome"))).toBe(true);
  });

  it("uses Playwright CDP connection by default", async () => {
    const page = createMockPage();
    const close = vi.fn(async () => {});
    const launchChrome = vi.fn(async () => ({
      process: { kill: vi.fn() },
      debugPort: 9222,
      profileDir: "/tmp/.chrome-profile",
    }));

    connectOverCDPMock.mockResolvedValue({
      contexts: () => [
        {
          pages: () => [page],
        },
      ],
      close,
    });

    await interactiveBrowserLogin(
      { log: () => {} },
      {
        launchChrome,
        validateCredentials: vi.fn(async () => {}),
      },
    );

    expect(connectOverCDPMock).toHaveBeenCalledWith("http://127.0.0.1:9222");
  });
});

describe("findNotebookLMPage", () => {
  it("reuses an existing NotebookLM tab when present", async () => {
    const notebookPage = createMockPage();
    const browser = {
      contexts: () => [
        {
          pages: () => [notebookPage],
          newPage: vi.fn(),
        },
      ],
      newContext: vi.fn(),
    };

    const page = await findNotebookLMPage(browser as never);
    expect(page).toBe(notebookPage);
  });

  it("opens NotebookLM when no matching tab exists", async () => {
    const page = createMockPage({ url: "about:blank" });
    const browser = {
      contexts: () => [
        {
          pages: () => [page],
          newPage: vi.fn(async () => page),
        },
      ],
      newContext: vi.fn(),
    };

    await findNotebookLMPage(browser as never);
    expect(page.goto).toHaveBeenCalledWith(
      "https://notebooklm.google.com/",
      expect.objectContaining({ waitUntil: "domcontentloaded" }),
    );
  });

  it("creates a browser context when none exists", async () => {
    const page = createMockPage({ url: "about:blank" });
    const newContext = vi.fn(async () => ({
      pages: () => [],
      newPage: vi.fn(async () => page),
    }));

    await findNotebookLMPage({
      contexts: () => [],
      newContext,
    } as never);

    expect(newContext).toHaveBeenCalledOnce();
    expect(page.goto).toHaveBeenCalled();
  });
});

describe("waitForNotebookLMSession", () => {
  it("returns credentials once API validation succeeds", async () => {
    const page = createMockPage();
    const validateCredentials = vi.fn(async () => {});

    await expect(
      waitForNotebookLMSession(page as never, validateCredentials),
    ).resolves.toEqual({
      authToken: "auth-token",
      cookies: expect.stringContaining("SAPISID="),
    });

    expect(validateCredentials).toHaveBeenCalled();
  });
});

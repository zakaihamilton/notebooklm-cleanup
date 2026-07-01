import { access } from "node:fs/promises";
import path from "node:path";
import { type ChildProcess, spawn } from "node:child_process";

const DEFAULT_DEBUG_PORT = 9222;
const DEBUG_PORT_WAIT_MS = 30_000;

export interface ChromeSession {
  process: ChildProcess;
  debugPort: number;
  profileDir: string;
}

export function getChromeProfileDir(projectRoot = process.cwd()): string {
  return path.join(projectRoot, ".chrome-profile");
}

export function getChromeDebugPort(): number {
  const configured = Number(process.env.CHROME_DEBUG_PORT);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_DEBUG_PORT;
}

export async function resolveChromeExecutablePath(): Promise<string> {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : process.platform === "win32"
        ? [
            String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
            String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next install location.
    }
  }

  throw new Error(
    "Google Chrome was not found. Install Chrome or set CHROME_PATH in your environment.",
  );
}

export async function waitForDebugPort(
  port: number,
  timeoutMs = DEBUG_PORT_WAIT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const debugUrl = `http://127.0.0.1:${port}/json/version`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(debugUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Chrome is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Chrome on debug port ${port}.`);
}

export async function launchChromeForLogin(options?: {
  profileDir?: string;
  debugPort?: number;
  chromePath?: string;
}): Promise<ChromeSession> {
  const profileDir = options?.profileDir ?? getChromeProfileDir();
  const debugPort = options?.debugPort ?? getChromeDebugPort();
  const chromePath = options?.chromePath ?? (await resolveChromeExecutablePath());

  const chromeProcess = spawn(
    chromePath,
    [
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${debugPort}`,
      "--no-first-run",
      "--no-default-browser-check",
      "https://notebooklm.google.com/",
    ],
    {
      detached: false,
      stdio: "ignore",
    },
  );

  await waitForDebugPort(debugPort);

  return {
    process: chromeProcess,
    debugPort,
    profileDir,
  };
}

export function stopChrome(session: ChromeSession): void {
  if (session.process.killed || session.process.exitCode !== null) {
    return;
  }

  session.process.kill("SIGTERM");
}

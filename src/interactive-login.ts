import { chromium, type Browser, type Page } from "playwright";
import { saveCredentials } from "notebooklm-kit";
import {
  launchChromeForLogin,
  stopChrome,
  type ChromeSession,
} from "./chrome-launcher.js";
import type { SavedCredentials } from "./credentials.js";
import {
  buildCookieString,
  isNotebookLmSessionReady,
} from "./session-utils.js";
import { validateSessionWithSdk } from "./validate-session.js";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
const AUTH_TOKEN_ATTEMPTS = 10;
const POST_LOAD_WAIT_MS = 3000;
const NOTEBOOKLM_URL = "https://notebooklm.google.com/";

export interface InteractiveLoginLogger {
  log: (message: string) => void;
}

export interface InteractiveLoginDeps {
  launchChrome?: typeof launchChromeForLogin;
  connectOverCDP?: (debugPort: number) => Promise<Browser>;
  stopChromeSession?: (session: ChromeSession) => void;
  validateCredentials?: (credentials: SavedCredentials) => Promise<void>;
}

async function extractAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const globalData = (window as Window & {
      WIZ_global_data?: { SNlM0e?: string };
    }).WIZ_global_data;

    return globalData?.SNlM0e ?? null;
  });
}

async function extractCookieString(page: Page): Promise<string> {
  let documentCookies = "";

  try {
    documentCookies = await page.evaluate(() => document.cookie);
  } catch {
    // Ignore inaccessible document.cookie values.
  }

  const contextCookies = await page.context().cookies();
  return buildCookieString(documentCookies, contextCookies);
}

export async function extractSessionCredentials(
  page: Page,
): Promise<SavedCredentials> {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(POST_LOAD_WAIT_MS);

  let authToken: string | null = null;

  for (let attempt = 0; attempt < AUTH_TOKEN_ATTEMPTS; attempt++) {
    authToken = await extractAuthToken(page);
    if (authToken) {
      break;
    }

    await page.waitForTimeout(2000);
  }

  if (!authToken) {
    throw new Error("Failed to extract NotebookLM auth token from the browser session.");
  }

  const cookies = await extractCookieString(page);
  return { authToken, cookies };
}

export async function waitForNotebookLMSession(
  page: Page,
  validateCredentials: (
    credentials: SavedCredentials,
  ) => Promise<void> = validateSessionWithSdk,
): Promise<SavedCredentials> {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const currentUrl = page.url();
    const authToken = await extractAuthToken(page);
    const cookies = await extractCookieString(page);

    if (!isNotebookLmSessionReady(currentUrl, authToken, cookies) || !authToken) {
      await page.waitForTimeout(POLL_INTERVAL_MS);
      continue;
    }

    try {
      const credentials = await extractSessionCredentials(page);
      await validateCredentials(credentials);
      return credentials;
    } catch {
      await page.waitForTimeout(POLL_INTERVAL_MS);
    }
  }

  throw new Error(
    "Timed out waiting for NotebookLM login. Complete Google sign-in in Chrome and wait until the notebook list loads.",
  );
}

export async function findNotebookLMPage(browser: Browser): Promise<Page> {
  for (const context of browser.contexts()) {
    const existingPage = context
      .pages()
      .find((page) => page.url().includes("notebooklm.google.com"));

    if (existingPage) {
      return existingPage;
    }
  }

  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());

  if (!page.url().includes("notebooklm.google.com")) {
    await page.goto(NOTEBOOKLM_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  }

  return page;
}

export async function interactiveBrowserLogin(
  logger: InteractiveLoginLogger = { log: console.log },
  deps: InteractiveLoginDeps = {},
): Promise<SavedCredentials> {
  const launchChrome = deps.launchChrome ?? launchChromeForLogin;
  const connectOverCDP =
    deps.connectOverCDP ??
    ((debugPort: number) => chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`));
  const stopChromeSession = deps.stopChromeSession ?? stopChrome;
  const validateCredentials = deps.validateCredentials ?? validateSessionWithSdk;

  logger.log("No saved NotebookLM credentials were found.");
  logger.log("Opening Google Chrome for sign-in...");
  logger.log("Sign in with your Google account and wait until the NotebookLM notebook list loads.");

  const chromeSession = await launchChrome();
  let browser: Browser | undefined;

  try {
    browser = await connectOverCDP(chromeSession.debugPort);
    const page = await findNotebookLMPage(browser);
    logger.log("Verifying NotebookLM API access before saving credentials...");

    const credentials = await waitForNotebookLMSession(page, validateCredentials);
    await saveCredentials(credentials);

    logger.log("Authentication complete. Credentials saved to credentials.json.");

    return credentials;
  } finally {
    if (browser) {
      await browser.close();
    }

    stopChromeSession(chromeSession);
  }
}

import {
  loadCredentials,
  NotebookLMClient,
  type NotebookLMConfig,
} from "notebooklm-kit";
import { hasCredentialsAvailable, type SavedCredentials } from "./credentials.js";
import { interactiveBrowserLogin } from "./interactive-login.js";
import { hasRequiredAuthCookies } from "./session-utils.js";
import { validateSessionWithSdk } from "./validate-session.js";

export interface EnsureCredentialsOptions {
  loadSavedCredentials?: () => Promise<SavedCredentials | null>;
  interactiveLogin?: typeof interactiveBrowserLogin;
  validateCredentials?: (credentials: SavedCredentials) => Promise<void>;
  log?: (message: string) => void;
  forceInteractiveLogin?: boolean;
  env?: {
    NOTEBOOKLM_AUTH_TOKEN?: string;
    NOTEBOOKLM_COOKIES?: string;
    GOOGLE_EMAIL?: string;
    GOOGLE_PASSWORD?: string;
  };
}

function resolveCredentialSources(
  savedCredentials: SavedCredentials | null,
  env: EnsureCredentialsOptions["env"] = {},
): Parameters<typeof hasCredentialsAvailable>[0] {
  return {
    envAuthToken: env.NOTEBOOKLM_AUTH_TOKEN ?? process.env.NOTEBOOKLM_AUTH_TOKEN,
    envCookies: env.NOTEBOOKLM_COOKIES ?? process.env.NOTEBOOKLM_COOKIES,
    savedCredentials,
    googleEmail: env.GOOGLE_EMAIL ?? process.env.GOOGLE_EMAIL,
    googlePassword: env.GOOGLE_PASSWORD ?? process.env.GOOGLE_PASSWORD,
  };
}

function isUsableSavedCredentials(
  savedCredentials: SavedCredentials | null,
): savedCredentials is SavedCredentials {
  return (
    !!savedCredentials?.authToken &&
    hasRequiredAuthCookies(savedCredentials.cookies)
  );
}

function credentialsFromSources(
  sources: ReturnType<typeof resolveCredentialSources>,
): SavedCredentials | null {
  if (sources.envAuthToken && sources.envCookies) {
    return {
      authToken: sources.envAuthToken,
      cookies: sources.envCookies,
    };
  }

  if (isUsableSavedCredentials(sources.savedCredentials ?? null)) {
    return sources.savedCredentials ?? null;
  }

  return null;
}

export async function ensureCredentials(
  options: EnsureCredentialsOptions = {},
): Promise<SavedCredentials> {
  const log = options.log ?? console.log;
  const loadSavedCredentials = options.loadSavedCredentials ?? loadCredentials;
  const interactiveLogin = options.interactiveLogin ?? interactiveBrowserLogin;
  const validateCredentials = options.validateCredentials ?? validateSessionWithSdk;

  if (options.forceInteractiveLogin) {
    return interactiveLogin({ log });
  }

  const savedCredentials = await loadSavedCredentials();
  const sources = resolveCredentialSources(savedCredentials, options.env);
  const existingCredentials = credentialsFromSources(sources);

  if (existingCredentials) {
    try {
      await validateCredentials(existingCredentials);
      return existingCredentials;
    } catch {
      log("Saved credentials are no longer valid. Re-authenticating...");
    }
  } else if (savedCredentials && !isUsableSavedCredentials(savedCredentials)) {
    log("Saved credentials are missing required session cookies. Re-authenticating...");
  } else if (!hasCredentialsAvailable(sources)) {
    return interactiveLogin({ log });
  }

  return interactiveLogin({ log });
}

export function createNotebookLMClient(
  credentials: SavedCredentials,
  config: NotebookLMConfig = {},
): NotebookLMClient {
  return new NotebookLMClient({
    authToken: credentials.authToken,
    cookies: credentials.cookies,
    debug: process.env.NOTEBOOKLM_DEBUG === "true",
    autoRefresh: false,
    auth: {
      email: process.env.GOOGLE_EMAIL,
      password: process.env.GOOGLE_PASSWORD,
      headless: process.env.GOOGLE_HEADLESS !== "false",
      ...config.auth,
    },
    ...config,
  });
}

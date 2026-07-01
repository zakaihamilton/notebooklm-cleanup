import { NotebookLMClient } from "notebooklm-kit";
import type { SavedCredentials } from "./credentials.js";

export async function validateSessionWithSdk(
  credentials: SavedCredentials,
): Promise<void> {
  const sdk = new NotebookLMClient({
    authToken: credentials.authToken,
    cookies: credentials.cookies,
    autoRefresh: false,
    debug: process.env.NOTEBOOKLM_DEBUG === "true",
  });

  try {
    await sdk.connect();
    await sdk.notebooks.list();
  } finally {
    sdk.dispose();
  }
}

import "dotenv/config";
import {
  createNotebookLMClient,
  ensureCredentials,
} from "./src/create-client.js";
import { runCleanup } from "./src/run-cleanup.js";

async function main(): Promise<void> {
  const credentials = await ensureCredentials();
  const sdk = createNotebookLMClient(credentials);

  try {
    await runCleanup({ sdk });
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exitCode = 1;
  } finally {
    sdk.dispose();
  }
}

main();

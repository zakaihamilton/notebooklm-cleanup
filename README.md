# notebooklm-cleanup

Delete the 100 least-recently-used (oldest by `updatedAt`) notebooks from a Google NotebookLM account.

## What it does

This CLI connects to NotebookLM via [`notebooklm-kit`](https://www.npmjs.com/package/notebooklm-kit), lists your notebooks, selects the 100 oldest by modification date, shows a preview table, asks for confirmation, and deletes the selected notebooks in parallel.

## Prerequisites

- Node.js 18+
- A Google NotebookLM account

## Setup

```bash
pnpm install
cp .env.example .env
```

Authentication options (pick one):

1. **Interactive browser login (default)** — run `pnpm run cleanup` with no credentials configured. The script launches your installed **Google Chrome** directly (not an automated test browser) and connects over remote debugging, which avoids Google’s “browser may not be secure” block. Sign in normally, wait for the notebook list to load, and credentials are saved to `credentials.json`.
2. **Auto-login** — set `GOOGLE_EMAIL` and `GOOGLE_PASSWORD` in `.env` (accounts without 2FA). Use `GOOGLE_HEADLESS=false` if you need to complete extra verification in the browser.
3. **Manual tokens** — set `NOTEBOOKLM_AUTH_TOKEN` and `NOTEBOOKLM_COOKIES` in `.env` from browser DevTools.

## Usage

```bash
pnpm run cleanup
```

On the first run without saved credentials, Google Chrome opens to NotebookLM. Sign in with your normal Google account and wait until the notebook list loads. The script saves `credentials.json` and reuses it on future runs.

If Chrome does not open automatically, install Google Chrome or set `CHROME_PATH` in `.env` to your Chrome executable.

## Confirmation flow

Before anything is deleted, the script:

1. Prints a preview table of the selected notebooks (`#`, `Title`, `Updated At`)
2. Prints a warning that deletion is permanent
3. Re-displays the notebook list under `Notebooks marked for deletion:`
4. Prompts: `Type delete to permanently remove these N notebooks, or press Enter to cancel:`

Type `delete` in any casing (`delete`, `DELETE`, `Delete`) to proceed. Any other input, including Enter, cancels safely.

## Safety

- No notebooks are deleted without explicit confirmation
- Cancellation is safe and does not call the delete API
- The preview table lets you review exactly what will be removed

## Testing

```bash
pnpm test
pnpm run test:coverage
```

Component tests cover notebook selection, table formatting, confirmation logic, and the orchestration pipeline with a mocked SDK.

## SDK limitation

`notebooklm-kit`'s `notebooks.list()` returns only **recently viewed** notebooks, not necessarily every notebook in your account. Notebooks that never appear in the list response will not be candidates for deletion.

## Project structure

```
cleanup.ts                 # Entry point; loads .env, ensures auth, runs cleanup
src/
  create-client.ts         # Credential bootstrap and NotebookLMClient factory
  interactive-login.ts     # Visible-browser login when no credentials exist
  credentials.ts           # Credential source detection
  select-notebooks.ts      # Timestamp resolution, sorting, and selection
  format-table.ts          # Fixed-width preview table formatting
  confirm-deletion.ts      # Interactive readline confirmation
  run-cleanup.ts           # Full cleanup pipeline
  *.test.ts                # Component tests
```

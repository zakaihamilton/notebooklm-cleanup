import { describe, expect, it, vi } from "vitest";

const { connectMock, disposeMock, listMock } = vi.hoisted(() => ({
  connectMock: vi.fn(async () => {}),
  disposeMock: vi.fn(),
  listMock: vi.fn(async () => []),
}));

vi.mock("notebooklm-kit", () => ({
  NotebookLMClient: vi.fn(
    class {
      connect = connectMock;
      dispose = disposeMock;
      notebooks = { list: listMock };
    },
  ),
}));

import { validateSessionWithSdk } from "./validate-session.js";

describe("validateSessionWithSdk", () => {
  it("connects and lists notebooks with the provided credentials", async () => {
    const credentials = {
      authToken: "token",
      cookies: "cookies",
    };

    await validateSessionWithSdk(credentials);

    expect(connectMock).toHaveBeenCalledOnce();
    expect(listMock).toHaveBeenCalledOnce();
    expect(disposeMock).toHaveBeenCalledOnce();
  });
});

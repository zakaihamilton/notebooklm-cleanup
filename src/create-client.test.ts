import { describe, expect, it, vi } from "vitest";
import { createNotebookLMClient, ensureCredentials } from "./create-client.js";
import { hasCredentialsAvailable } from "./credentials.js";

const validCookies = `SAPISID=${"x".repeat(50)}; SID=${"y".repeat(50)}`;

describe("hasCredentialsAvailable", () => {
  it("accepts env auth token and cookies", () => {
    expect(
      hasCredentialsAvailable({
        envAuthToken: "token",
        envCookies: "cookies",
      }),
    ).toBe(true);
  });

  it("accepts saved credentials", () => {
    expect(
      hasCredentialsAvailable({
        savedCredentials: {
          authToken: "token",
          cookies: validCookies,
        },
      }),
    ).toBe(true);
  });

  it("accepts google email and password", () => {
    expect(
      hasCredentialsAvailable({
        googleEmail: "user@example.com",
        googlePassword: "secret",
      }),
    ).toBe(true);
  });

  it("returns false when no credential source is complete", () => {
    expect(
      hasCredentialsAvailable({
        envAuthToken: "token",
        googleEmail: "user@example.com",
      }),
    ).toBe(false);
  });
});

describe("ensureCredentials", () => {
  it("returns saved credentials when they still work", async () => {
    const interactiveLogin = vi.fn();
    const validateCredentials = vi.fn(async () => {});
    const saved = {
      authToken: "saved-token",
      cookies: validCookies,
    };

    await expect(
      ensureCredentials({
        loadSavedCredentials: async () => saved,
        interactiveLogin,
        validateCredentials,
        log: () => {},
      }),
    ).resolves.toEqual(saved);

    expect(interactiveLogin).not.toHaveBeenCalled();
    expect(validateCredentials).toHaveBeenCalledWith(saved);
  });

  it("runs interactive login when no credentials are available", async () => {
    const interactiveLogin = vi.fn(async () => ({
      authToken: "token",
      cookies: validCookies,
    }));

    await expect(
      ensureCredentials({
        loadSavedCredentials: async () => null,
        interactiveLogin,
        validateCredentials: vi.fn(async () => {}),
        log: () => {},
        env: {},
      }),
    ).resolves.toEqual({
      authToken: "token",
      cookies: validCookies,
    });
  });

  it("re-authenticates when saved credentials fail validation", async () => {
    const interactiveLogin = vi.fn(async () => ({
      authToken: "fresh-token",
      cookies: validCookies,
    }));

    const result = await ensureCredentials({
      loadSavedCredentials: async () => ({
        authToken: "saved-token",
        cookies: validCookies,
      }),
      interactiveLogin,
      validateCredentials: vi.fn(async () => {
        throw new Error("401");
      }),
      log: () => {},
    });

    expect(interactiveLogin).toHaveBeenCalledOnce();
    expect(result.authToken).toBe("fresh-token");
  });

  it("re-authenticates when saved credentials are missing required cookies", async () => {
    const interactiveLogin = vi.fn(async () => ({
      authToken: "fresh-token",
      cookies: validCookies,
    }));

    await ensureCredentials({
      loadSavedCredentials: async () => ({
        authToken: "saved-token",
        cookies: "incomplete-cookies",
      }),
      interactiveLogin,
      validateCredentials: vi.fn(async () => {}),
      log: () => {},
    });

    expect(interactiveLogin).toHaveBeenCalledOnce();
  });

  it("forces interactive login when requested", async () => {
    const interactiveLogin = vi.fn(async () => ({
      authToken: "token",
      cookies: validCookies,
    }));

    await ensureCredentials({
      loadSavedCredentials: async () => ({
        authToken: "saved-token",
        cookies: validCookies,
      }),
      interactiveLogin,
      validateCredentials: vi.fn(async () => {}),
      log: () => {},
      forceInteractiveLogin: true,
    });

    expect(interactiveLogin).toHaveBeenCalledOnce();
  });

  it("returns env credentials when they validate successfully", async () => {
    await expect(
      ensureCredentials({
        loadSavedCredentials: async () => null,
        interactiveLogin: vi.fn(),
        validateCredentials: vi.fn(async () => {}),
        log: () => {},
        env: {
          NOTEBOOKLM_AUTH_TOKEN: "env-token",
          NOTEBOOKLM_COOKIES: "env-cookies",
        },
      }),
    ).resolves.toEqual({
      authToken: "env-token",
      cookies: "env-cookies",
    });
  });
});

describe("createNotebookLMClient", () => {
  it("creates a NotebookLMClient instance", () => {
    expect(
      createNotebookLMClient({
        authToken: "token",
        cookies: validCookies,
      }),
    ).toBeDefined();
  });
});

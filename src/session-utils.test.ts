import { describe, expect, it } from "vitest";
import {
  buildCookieString,
  getCookieValue,
  hasRequiredAuthCookies,
  isNotebookLmSessionReady,
} from "./session-utils.js";

describe("getCookieValue", () => {
  it("reads a cookie by name", () => {
    expect(getCookieValue("SAPISID=abc; SID=def", "SAPISID")).toBe("abc");
  });

  it("ignores empty cookie segments", () => {
    expect(getCookieValue("SAPISID=abc;;", "SAPISID")).toBe("abc");
  });
});

describe("hasRequiredAuthCookies", () => {
  it("requires SAPISID, SID, and a minimum cookie length", () => {
    const cookies = `SAPISID=${"x".repeat(50)}; SID=${"y".repeat(50)}`;
    expect(hasRequiredAuthCookies(cookies)).toBe(true);
    expect(hasRequiredAuthCookies("x".repeat(100))).toBe(false);
  });

  it("accepts secure Google session cookies", () => {
    const cookies = `SAPISID=${"x".repeat(50)}; __Secure-1PSID=${"y".repeat(50)}`;
    expect(hasRequiredAuthCookies(cookies)).toBe(true);
  });
});

describe("buildCookieString", () => {
  it("merges document and context cookies", () => {
    const cookieString = buildCookieString("SID=abc", [
      { name: "HSID", value: "def", domain: ".google.com" },
    ]);

    expect(cookieString).toContain("SID=abc");
    expect(cookieString).toContain("HSID=def");
  });

  it("includes all context cookies", () => {
    const cookieString = buildCookieString("", [
      { name: "other", value: "value", domain: "example.com" },
    ]);

    expect(cookieString).toBe("other=value");
  });
});

describe("isNotebookLmSessionReady", () => {
  const readyCookies = `SAPISID=${"x".repeat(50)}; SID=${"y".repeat(50)}`;

  it("returns true when auth token and cookies are ready", () => {
    expect(
      isNotebookLmSessionReady(
        "https://notebooklm.google.com/",
        "token",
        readyCookies,
      ),
    ).toBe(true);
  });

  it("returns false on sign-in or challenge pages", () => {
    expect(
      isNotebookLmSessionReady(
        "https://accounts.google.com/signin",
        "token",
        readyCookies,
      ),
    ).toBe(false);
  });

  it("returns false without an auth token", () => {
    expect(
      isNotebookLmSessionReady(
        "https://notebooklm.google.com/",
        null,
        readyCookies,
      ),
    ).toBe(false);
  });

  it("returns false without SAPISID", () => {
    expect(
      isNotebookLmSessionReady(
        "https://notebooklm.google.com/",
        "token",
        "x".repeat(100),
      ),
    ).toBe(false);
  });
});

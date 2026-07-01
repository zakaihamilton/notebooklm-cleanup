export interface BrowserCookie {
  name: string;
  value: string;
  domain?: string;
}

export function getCookieValue(
  cookieString: string,
  name: string,
): string | null {
  for (const part of cookieString.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const [cookieName, ...valueParts] = trimmed.split("=");
    if (cookieName === name) {
      return valueParts.join("=");
    }
  }

  return null;
}

export function hasRequiredAuthCookies(cookieString: string): boolean {
  const hasGoogleSession =
    getCookieValue(cookieString, "SID") !== null ||
    getCookieValue(cookieString, "__Secure-1PSID") !== null ||
    getCookieValue(cookieString, "__Secure-3PSID") !== null;

  return (
    cookieString.length >= 100 &&
    getCookieValue(cookieString, "SAPISID") !== null &&
    hasGoogleSession
  );
}

export function buildCookieString(
  documentCookies: string,
  contextCookies: BrowserCookie[],
): string {
  const cookieMap = new Map<string, string>();

  if (documentCookies) {
    for (const pair of documentCookies.split(";").map((cookie) => cookie.trim())) {
      const [name, ...valueParts] = pair.split("=");
      if (name && valueParts.length > 0) {
        cookieMap.set(name.trim(), valueParts.join("="));
      }
    }
  }

  for (const cookie of contextCookies) {
    cookieMap.set(cookie.name, cookie.value);
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export function isNotebookLmSessionReady(
  currentUrl: string,
  authToken: string | null,
  cookieString: string,
): boolean {
  if (!authToken) {
    return false;
  }

  if (
    currentUrl.includes("accounts.google.com/signin") ||
    currentUrl.includes("challenge")
  ) {
    return false;
  }

  return hasRequiredAuthCookies(cookieString);
}

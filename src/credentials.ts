export interface SavedCredentials {
  authToken: string;
  cookies: string;
}

export interface CredentialSources {
  envAuthToken?: string;
  envCookies?: string;
  savedCredentials?: SavedCredentials | null;
  googleEmail?: string;
  googlePassword?: string;
}

export function hasCredentialsAvailable(sources: CredentialSources): boolean {
  if (sources.envAuthToken && sources.envCookies) {
    return true;
  }

  if (sources.savedCredentials?.authToken && sources.savedCredentials?.cookies) {
    return true;
  }

  if (sources.googleEmail && sources.googlePassword) {
    return true;
  }

  return false;
}

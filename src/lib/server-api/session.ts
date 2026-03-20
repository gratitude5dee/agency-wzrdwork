const SESSION_STORAGE_KEY = "agency.server.sessionToken";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getServerSessionToken(): string | null {
  if (!canUseStorage()) return null;
  const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
  return token && token.trim() !== "" ? token : null;
}

export function setServerSessionToken(token: string | null): void {
  if (!canUseStorage()) return;
  if (!token || token.trim() === "") {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function clearServerSessionToken(): void {
  setServerSessionToken(null);
}

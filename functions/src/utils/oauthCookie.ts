export const OAUTH_STATE_COOKIE = "genesis_oauth_state";

export function oauthStateCookieValue(
  header: string | undefined,
): string | undefined {
  if (!header) {
    return undefined;
  }
  const parts = header.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    if (name === OAUTH_STATE_COOKIE && rest.length > 0) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

export function buildOAuthStateCookie(state: string): string {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  const sameSite = isEmulator ? "Lax" : "None";
  const secure = isEmulator ? "" : "; Secure";
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; HttpOnly; Path=/; Max-Age=600; SameSite=${sameSite}${secure}`;
}

export function clearOAuthStateCookie(): string {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  const sameSite = isEmulator ? "Lax" : "None";
  const secure = isEmulator ? "" : "; Secure";
  return `${OAUTH_STATE_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=${sameSite}${secure}`;
}

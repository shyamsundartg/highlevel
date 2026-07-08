export const HL_AUTH_BASE =
  "https://marketplace.gohighlevel.com/oauth/chooselocation";
export const HL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
export const HL_API_BASE = "https://services.leadconnectorhq.com";
export const HL_API_VERSION = "2023-02-21";
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export const HL_ALLOWED_PATH_PREFIXES = [
  "/contacts",
  "/conversations",
  "/calendars",
  "/appointments",
  "/events",
  "/free-slots",
] as const;
export const HL_USER_TYPE = "Location";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

import { HL_ALLOWED_PATH_PREFIXES, HL_API_BASE } from "./constants";
import { HlApiError } from "./errors";

/** Reject path traversal and encoded dot segments before URL normalization. */
export function rejectUnsafePathSegments(path: string): void {
  const lower = path.toLowerCase();
  if (
    path.includes("..") ||
    lower.includes("%2e%2e") ||
    lower.includes("%2e/") ||
    lower.includes("/%2e")
  ) {
    throw new HlApiError(
      "HL_PATH_NOT_ALLOWED",
      "Path traversal is not allowed",
      403,
    );
  }
}

function matchesAllowedPrefix(pathname: string, prefix: string): boolean {
  if (pathname === prefix) {
    return true;
  }
  if (!pathname.startsWith(prefix)) {
    return false;
  }
  const next = pathname[prefix.length];
  return next === "/";
}

/** Validate and return the resolved HL API pathname (no traversal, strict prefix). */
export function assertAllowedPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  rejectUnsafePathSegments(normalized);

  const resolvedPath = new URL(`${HL_API_BASE}${normalized}`).pathname;
  const allowed = HL_ALLOWED_PATH_PREFIXES.some((prefix) =>
    matchesAllowedPrefix(resolvedPath, prefix),
  );
  if (!allowed) {
    throw new HlApiError(
      "HL_PATH_NOT_ALLOWED",
      `Path not allowed: ${resolvedPath}`,
      403,
    );
  }
  return resolvedPath;
}

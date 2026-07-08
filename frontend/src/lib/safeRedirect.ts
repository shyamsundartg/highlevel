/** Allow only same-app relative paths (blocks open redirects). */
export function safeRedirectPath(redirect: string | undefined | null): string {
  if (!redirect || typeof redirect !== "string") {
    return "/projects";
  }
  const trimmed = redirect.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/projects";
  }
  if (trimmed.includes("://") || trimmed.includes("\\")) {
    return "/projects";
  }
  return trimmed;
}

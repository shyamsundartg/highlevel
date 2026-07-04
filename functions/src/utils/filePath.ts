import { decodeFileId, encodeFileId } from "./fileId";

const ALLOWED_EXTENSIONS = new Set([
  ".vue",
  ".ts",
  ".js",
  ".css",
  ".html",
  ".json",
]);

const LANGUAGE_BY_EXT: Record<string, string> = {
  ".vue": "vue",
  ".ts": "typescript",
  ".js": "javascript",
  ".css": "css",
  ".html": "html",
  ".json": "json",
};

export function validateFilePath(path: string): string {
  const normalized = path.replace(/^\/+/, "").trim();
  if (!normalized) {
    throw new Error("File path cannot be empty");
  }
  if (normalized.includes("..")) {
    throw new Error("File path cannot contain '..'");
  }

  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex === -1) {
    throw new Error("File path must include an extension");
  }

  const ext = normalized.slice(dotIndex).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File extension not allowed: ${ext}`);
  }

  return normalized;
}

export function inferLanguage(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}

export function pathToFileId(path: string): string {
  return encodeFileId(validateFilePath(path));
}

export function fileIdToPath(fileId: string): string {
  return validateFilePath(decodeFileId(fileId));
}

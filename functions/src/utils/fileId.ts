const FILE_ID_SEPARATOR = "__";

export function encodeFileId(path: string): string {
  const normalized = path.replace(/^\/+/, "").trim();
  if (!normalized) {
    throw new Error("File path cannot be empty");
  }
  if (normalized.includes("..")) {
    throw new Error("File path cannot contain '..'");
  }
  return normalized.replace(/\//g, FILE_ID_SEPARATOR);
}

export function decodeFileId(fileId: string): string {
  if (!fileId) {
    throw new Error("File ID cannot be empty");
  }
  return fileId.replace(new RegExp(FILE_ID_SEPARATOR, "g"), "/");
}

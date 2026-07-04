const FILE_ID_SEPARATOR = "__";

export function encodeFileId(path: string): string {
  const normalized = path.replace(/^\/+/, "").trim();
  return normalized.replace(/\//g, FILE_ID_SEPARATOR);
}

export function decodeFileId(fileId: string): string {
  return fileId.replace(new RegExp(FILE_ID_SEPARATOR, "g"), "/");
}

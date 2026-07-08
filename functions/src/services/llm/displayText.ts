import { parseFileBlocks } from "./parser";
import { SnapshotFileEntry } from "../../types/firestore";

export function buildAssistantDisplayText(
  rawText: string,
  filesWritten: Record<string, SnapshotFileEntry>,
): string {
  const { plainText } = parseFileBlocks(rawText);
  const summary = plainText.trim();
  if (summary) {
    return summary;
  }

  const paths = Object.keys(filesWritten);
  if (paths.length > 0) {
    return `Updated ${paths.join(", ")}.`;
  }

  return rawText.trim();
}

import { describe, expect, it } from "vitest";
import { buildAssistantDisplayText } from "./displayText";

describe("buildAssistantDisplayText", () => {
  it("returns plain summary when present after file blocks", () => {
    const raw =
      '<<<FILE path="preview.html" language="html">>>\n<html></html>\n<<<END_FILE>>>\nAll done.';
    expect(buildAssistantDisplayText(raw, {})).toBe("All done.");
  });

  it("returns updated file list when response is file-only", () => {
    const raw =
      '<<<FILE path="preview.html" language="html">>>\n<html></html>\n<<<END_FILE>>>';
    expect(
      buildAssistantDisplayText(raw, {
        "preview.html": { content: "<html></html>", language: "html" },
      }),
    ).toBe("Updated preview.html.");
  });

  it("returns empty string when nothing was written", () => {
    expect(buildAssistantDisplayText("   ", {})).toBe("");
  });
});

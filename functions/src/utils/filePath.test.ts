import { describe, expect, it } from "vitest";
import {
  fileIdToPath,
  inferLanguage,
  pathToFileId,
  validateFilePath,
} from "./filePath";

describe("validateFilePath", () => {
  it("accepts valid paths and strips leading slashes", () => {
    expect(validateFilePath("preview.html")).toBe("preview.html");
    expect(validateFilePath("/preview.html")).toBe("preview.html");
    expect(validateFilePath("src/App.vue")).toBe("src/App.vue");
  });

  it("rejects invalid paths", () => {
    expect(() => validateFilePath("")).toThrow("empty");
    expect(() => validateFilePath("src/../etc/passwd")).toThrow("..");
    expect(() => validateFilePath("README")).toThrow("extension");
    expect(() => validateFilePath("malware.exe")).toThrow("not allowed");
    expect(() => validateFilePath("notes.md")).toThrow("not allowed");
  });
});

describe("inferLanguage", () => {
  it("maps known extensions", () => {
    expect(inferLanguage("a.vue")).toBe("vue");
    expect(inferLanguage("a.ts")).toBe("typescript");
    expect(inferLanguage("a.html")).toBe("html");
  });

  it("returns plaintext for unknown extensions", () => {
    expect(inferLanguage("a.xyz")).toBe("plaintext");
  });
});

describe("pathToFileId / fileIdToPath", () => {
  it("round-trips nested paths", () => {
    const path = "src/components/ContactList.vue";
    expect(fileIdToPath(pathToFileId(path))).toBe(path);
  });

  it("propagates validation errors", () => {
    expect(() => pathToFileId("../x.html")).toThrow("..");
  });
});

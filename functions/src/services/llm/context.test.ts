import { describe, expect, it, vi } from "vitest";

vi.mock("../projects/files", () => ({
  listFiles: vi.fn(),
  getFile: vi.fn(),
}));

vi.mock("../projects/messages", () => ({
  listMessages: vi.fn(),
}));

import { getFile, listFiles } from "../projects/files";
import { listMessages } from "../projects/messages";
import { buildGenerationContext } from "./context";

const listFilesMock = vi.mocked(listFiles);
const getFileMock = vi.mocked(getFile);
const listMessagesMock = vi.mocked(listMessages);

describe("buildGenerationContext", () => {
  it("builds minimal context for empty project", async () => {
    listFilesMock.mockResolvedValueOnce([]);
    listMessagesMock.mockResolvedValueOnce([]);

    const ctx = await buildGenerationContext("proj1", "SYSTEM");
    expect(ctx.systemPrompt).toBe("SYSTEM");
    expect(ctx.messages).toHaveLength(1);
    expect(ctx.messages[0].content).toBe("");
  });

  it("includes current project files", async () => {
    listFilesMock.mockResolvedValueOnce([
      {
        fileId: "preview.html",
        path: "preview.html",
        language: "html",
        sizeBytes: 10,
        updatedAt: 1,
      },
    ]);
    getFileMock.mockResolvedValueOnce({
      fileId: "preview.html",
      path: "preview.html",
      language: "html",
      sizeBytes: 10,
      updatedAt: 1,
      content: "<html></html>",
    });
    listMessagesMock.mockResolvedValueOnce([]);

    const ctx = await buildGenerationContext("proj1", "SYSTEM");
    expect(ctx.messages[0].content).toContain("Current project files:");
    expect(ctx.messages[0].content).toContain("--- preview.html (html) ---");
    expect(ctx.messages[0].content).toContain("<html></html>");
  });

  it("truncates large file content", async () => {
    const big = "x".repeat(9000);
    listFilesMock.mockResolvedValueOnce([
      {
        fileId: "preview.html",
        path: "preview.html",
        language: "html",
        sizeBytes: big.length,
        updatedAt: 1,
      },
    ]);
    getFileMock.mockResolvedValueOnce({
      fileId: "preview.html",
      path: "preview.html",
      language: "html",
      sizeBytes: big.length,
      updatedAt: 1,
      content: big,
    });
    listMessagesMock.mockResolvedValueOnce([]);

    const ctx = await buildGenerationContext("proj1", "SYSTEM");
    expect(ctx.messages[0].content).toContain("... [truncated]");
    expect(ctx.messages[0].content).not.toContain("x".repeat(9000));
  });

  it("skips files that cannot be loaded", async () => {
    listFilesMock.mockResolvedValueOnce([
      {
        fileId: "missing.html",
        path: "missing.html",
        language: "html",
        sizeBytes: 0,
        updatedAt: 1,
      },
    ]);
    getFileMock.mockResolvedValueOnce(null);
    listMessagesMock.mockResolvedValueOnce([]);

    const ctx = await buildGenerationContext("proj1", "SYSTEM");
    expect(ctx.messages[0].content).not.toContain("missing.html");
  });

  it("strips FILE blocks from assistant history", async () => {
    listFilesMock.mockResolvedValueOnce([]);
    listMessagesMock.mockResolvedValueOnce([
      {
        id: "m1",
        role: "user",
        content: "Build a dashboard",
        createdAt: 1,
      },
      {
        id: "m2",
        role: "assistant",
        content:
          '<<<FILE path="preview.html" language="html">>>\n<html></html>\n<<<END_FILE>>>\nBuilt your dashboard.',
        createdAt: 2,
      },
    ]);

    const ctx = await buildGenerationContext("proj1", "SYSTEM");
    expect(ctx.messages[0].content).toContain("ASSISTANT: Built your dashboard.");
    expect(ctx.messages[0].content).not.toContain("<<<FILE");
  });

  it("uses placeholder when assistant message is file-only", async () => {
    listFilesMock.mockResolvedValueOnce([]);
    listMessagesMock.mockResolvedValueOnce([
      {
        id: "m1",
        role: "assistant",
        content:
          '<<<FILE path="preview.html" language="html">>>\n<html></html>\n<<<END_FILE>>>',
        createdAt: 1,
      },
    ]);

    const ctx = await buildGenerationContext("proj1", "SYSTEM");
    expect(ctx.messages[0].content).toContain(
      "ASSISTANT: [Updated project files]",
    );
  });

  it("preserves user message content in history", async () => {
    listFilesMock.mockResolvedValueOnce([]);
    listMessagesMock.mockResolvedValueOnce([
      {
        id: "m1",
        role: "user",
        content: "Make header blue",
        createdAt: 1,
      },
    ]);

    const ctx = await buildGenerationContext("proj1", "SYSTEM");
    expect(ctx.messages[0].content).toContain("USER: Make header blue");
  });
});

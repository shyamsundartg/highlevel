import { describe, expect, it } from "vitest";
import { FileBlockParser, parseFileBlocks } from "./parser";

const FILE = (path: string, lang: string, body: string) =>
  `<<<FILE path="${path}" language="${lang}">>>\n${body}\n<<<END_FILE>>>`;

describe("parseFileBlocks", () => {
  it("parses a single file", () => {
    const { files, plainText } = parseFileBlocks(
      FILE("preview.html", "html", "<html></html>"),
    );
    expect(files).toHaveLength(1);
    expect(files[0]).toEqual({
      path: "preview.html",
      language: "html",
      content: "<html></html>",
    });
    expect(plainText).toBe("");
  });

  it("parses multiple files", () => {
    const input = [
      FILE("preview.html", "html", "<html></html>"),
      FILE("src/App.vue", "vue", "<template></template>"),
    ].join("\n");
    const { files } = parseFileBlocks(input);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("preview.html");
    expect(files[1].path).toBe("src/App.vue");
  });

  it("captures summary text after file blocks", () => {
    const input = `${FILE("a.html", "html", "x")}\nDone building the app.`;
    const { plainText } = parseFileBlocks(input);
    expect(plainText).toBe("Done building the app.");
  });

  it("returns all text as plainText when no files", () => {
    const { files, plainText } = parseFileBlocks("Hello, no files here.");
    expect(files).toHaveLength(0);
    expect(plainText).toBe("Hello, no files here.");
  });
});

describe("FileBlockParser", () => {
  it("emits file_start then file_end for a complete block", () => {
    const parser = new FileBlockParser();
    const events = parser.push(FILE("a.html", "html", "body"));
    expect(events[0].type).toBe("file_start");
    expect(events.at(-1)?.type).toBe("file_end");
    const fileEnd = events.find((e) => e.type === "file_end");
    expect(fileEnd && "content" in fileEnd && fileEnd.content).toBe("body");
  });

  it("handles header split across chunks", () => {
    const parser = new FileBlockParser();
    const header = '<<<FILE path="a.html" language="html">>>\n';
    const part1 = header.slice(0, 10);
    const part2 = header.slice(10) + "content\n<<<END_FILE>>>";

    const first = parser.push(part1);
    expect(first.some((e) => e.type === "file_start")).toBe(false);

    const second = parser.push(part2);
    expect(second.some((e) => e.type === "file_start")).toBe(true);
    expect(second.some((e) => e.type === "file_end")).toBe(true);
  });

  it("handles END_FILE marker split across chunks", () => {
    const parser = new FileBlockParser();
    const start = '<<<FILE path="a.html" language="html">>>\nbody';
    const end = "\n<<<END_FILE>>>";

    parser.push(start);
    const events = parser.push(end);
    expect(events.some((e) => e.type === "file_end")).toBe(true);
  });

  it("does not emit incomplete <<<FILE marker as token", () => {
    const parser = new FileBlockParser();
    const events = parser.push("prefix <<<FIL");
    const tokens = events.filter((e) => e.type === "token");
    expect(tokens.some((e) => e.text.includes("<<<FIL"))).toBe(false);
    expect(tokens.every((e) => "prefix <<<FIL".includes(e.text))).toBe(true);
  });

  it("flush closes open file without END_FILE (regression)", () => {
    const parser = new FileBlockParser();
    parser.push('<<<FILE path="preview.html" language="html">>>\n<html></html>');
    const flushed = parser.flush();
    expect(flushed).toEqual([
      expect.objectContaining({
        type: "file_end",
        path: "preview.html",
        content: "<html></html>",
      }),
    ]);
  });

  it("flush emits trailing plain text when not in file", () => {
    const parser = new FileBlockParser();
    parser.push("just text");
    const flushed = parser.flush();
    expect(flushed).toEqual([{ type: "token", text: "just text" }]);
  });

  it("strips one leading and one trailing newline from file content", () => {
    const { files } = parseFileBlocks(
      '<<<FILE path="a.html" language="html">>>\n\n<body/>\n\n<<<END_FILE>>>',
    );
    expect(files[0].content).toBe("<body/>\n");
  });
});

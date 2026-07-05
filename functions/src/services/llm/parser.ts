export interface ParsedFileBlock {
  path: string;
  language: string;
  content: string;
}

export type ParserEvent =
  | { type: "token"; text: string }
  | { type: "file_start"; path: string; language: string }
  | { type: "file_chunk"; path: string; chunk: string }
  | { type: "file_end"; path: string; language: string; content: string };

const FILE_START_RE =
  /^<<<FILE path="([^"]+)" language="([^"]+)">>>\n?/;
const FILE_END = "<<<END_FILE>>>";

export class FileBlockParser {
  private buffer = "";
  private inFile = false;
  private currentPath = "";
  private currentLanguage = "";
  private currentContent = "";

  push(chunk: string): ParserEvent[] {
    this.buffer += chunk;
    return this.drain();
  }

  flush(): ParserEvent[] {
    if (this.inFile) {
      if (this.buffer.length > 0) {
        this.currentContent += this.buffer;
        this.buffer = "";
      }
      return this.closeFile();
    }

    const events: ParserEvent[] = [];
    if (this.buffer.length > 0) {
      events.push({ type: "token", text: this.buffer });
      this.buffer = "";
    }
    return events;
  }

  private drain(): ParserEvent[] {
    const events: ParserEvent[] = [];

    while (this.buffer.length > 0) {
      if (!this.inFile) {
        const startIdx = this.buffer.indexOf("<<<FILE");
        if (startIdx === -1) {
          const safeLen = Math.max(0, this.buffer.length - 10);
          if (safeLen > 0) {
            events.push({ type: "token", text: this.buffer.slice(0, safeLen) });
            this.buffer = this.buffer.slice(safeLen);
          }
          break;
        }

        if (startIdx > 0) {
          events.push({ type: "token", text: this.buffer.slice(0, startIdx) });
          this.buffer = this.buffer.slice(startIdx);
        }

        const match = this.buffer.match(FILE_START_RE);
        if (!match) {
          break;
        }

        this.inFile = true;
        this.currentPath = match[1];
        this.currentLanguage = match[2];
        this.currentContent = "";
        this.buffer = this.buffer.slice(match[0].length);
        events.push({
          type: "file_start",
          path: this.currentPath,
          language: this.currentLanguage,
        });
        continue;
      }

      const endIdx = this.buffer.indexOf(FILE_END);
      if (endIdx === -1) {
        const chunk = this.buffer;
        this.buffer = "";
        if (chunk) {
          this.currentContent += chunk;
          events.push({
            type: "file_chunk",
            path: this.currentPath,
            chunk,
          });
        }
        break;
      }

      this.currentContent += this.buffer.slice(0, endIdx);
      this.buffer = this.buffer.slice(endIdx + FILE_END.length);
      events.push(...this.closeFile());
    }

    return events;
  }

  private closeFile(): ParserEvent[] {
    const content = this.currentContent.replace(/^\n/, "").replace(/\n$/, "");
    const events: ParserEvent[] = [
      {
        type: "file_end",
        path: this.currentPath,
        language: this.currentLanguage,
        content,
      },
    ];
    this.inFile = false;
    this.currentPath = "";
    this.currentLanguage = "";
    this.currentContent = "";
    return events;
  }
}

export function parseFileBlocks(text: string): {
  files: ParsedFileBlock[];
  plainText: string;
} {
  const parser = new FileBlockParser();
  const files: ParsedFileBlock[] = [];
  let plainText = "";

  for (const event of parser.push(text)) {
    if (event.type === "token") {
      plainText += event.text;
    } else if (event.type === "file_end") {
      files.push({
        path: event.path,
        language: event.language,
        content: event.content,
      });
    }
  }

  for (const event of parser.flush()) {
    if (event.type === "token") {
      plainText += event.text;
    } else if (event.type === "file_end") {
      files.push({
        path: event.path,
        language: event.language,
        content: event.content,
      });
    }
  }

  return { files, plainText: plainText.trim() };
}

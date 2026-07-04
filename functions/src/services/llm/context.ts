import { listFiles, getFile } from "../projects/files";
import { listMessages } from "../projects/messages";

export interface LlmContext {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

const MAX_CONTEXT_FILES = 20;
const MAX_FILE_CHARS = 8000;
const MAX_HISTORY_MESSAGES = 20;

export async function buildGenerationContext(
  projectId: string,
  userMessage: string,
  systemPrompt: string,
): Promise<LlmContext> {
  const [fileMetas, history] = await Promise.all([
    listFiles(projectId),
    listMessages(projectId, MAX_HISTORY_MESSAGES),
  ]);

  const filesToInclude = fileMetas.slice(0, MAX_CONTEXT_FILES);
  const fileContents: string[] = [];

  for (const meta of filesToInclude) {
    const file = await getFile(projectId, meta.fileId);
    if (!file) {
      continue;
    }
    const content =
      file.content.length > MAX_FILE_CHARS
        ? `${file.content.slice(0, MAX_FILE_CHARS)}\n... [truncated]`
        : file.content;
    fileContents.push(
      `--- ${file.path} (${file.language}) ---\n${content}`,
    );
  }

  const contextParts: string[] = [];
  if (fileContents.length > 0) {
    contextParts.push("Current project files:\n" + fileContents.join("\n\n"));
  }

  const priorMessages = history;
  if (priorMessages.length > 0) {
    const transcript = priorMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
    contextParts.push("Conversation history:\n" + transcript);
  }

  contextParts.push(`USER REQUEST:\n${userMessage}`);

  return {
    systemPrompt,
    messages: [{ role: "user", content: contextParts.join("\n\n") }],
  };
}

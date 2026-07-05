import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { assertGenerationEnv, env } from "./config/env";
import { buildGenerationContext } from "./services/llm/context";
import { FileBlockParser } from "./services/llm/parser";
import { SYSTEM_PROMPT } from "./services/llm/prompts";
import {
  GET_API_DOC_TOOL,
  runGetApiDocsTool,
} from "./services/llm/apiDocs";
import { addMessage } from "./services/projects/messages";
import { pathToFileId } from "./utils/filePath";
import { saveFile } from "./services/projects/files";
import { createSnapshot } from "./services/projects/snapshots";
import { getProjectForUser } from "./utils/projectAccess";
import { verifyBearerToken } from "./utils/verifyAuth";
import { SnapshotFileEntry } from "./types/firestore";

interface SseResponse {
  writableEnded?: boolean;
  destroyed?: boolean;
  write(chunk: string): boolean;
  end(): void;
  flushHeaders?(): void;
  on(event: string, listener: () => void): void;
  off(event: string, listener: () => void): void;
}

function writeSse(res: SseResponse, event: string, data: unknown): boolean {
  if (res.writableEnded || res.destroyed) {
    return false;
  }
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const name = "name" in err ? String(err.name) : "";
  const message = "message" in err ? String(err.message) : "";
  return (
    name === "AbortError" ||
    name === "APIUserAbortError" ||
    message.toLowerCase().includes("aborted")
  );
}

const MAX_TOOL_ROUNDS = 3;

export const generate = onRequest(
  {
    region: "asia-south1",
    cors: true,
    timeoutSeconds: 300,
    invoker: "public",
  },
  async (req, res) => {
    const sseRes = res as unknown as SseResponse;
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    let uid: string;
    try {
      uid = await verifyBearerToken(req.headers.authorization);
    } catch (err) {
      const code =
        err instanceof Error && "code" in err
          ? String((err as { code: string }).code)
          : "UNAUTHORIZED";
      logger.warn("Generation unauthorized", { code });
      res.status(401).json({ error: code });
      return;
    }

    const projectId =
      typeof req.body?.projectId === "string" ? req.body.projectId : "";
    const message =
      typeof req.body?.message === "string" ? req.body.message.trim() : "";

    if (!projectId || !message) {
      logger.warn("Generation validation failed", {
        uid,
        hasProjectId: !!projectId,
      });
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "projectId and message are required",
      });
      return;
    }

    const project = await getProjectForUser(projectId, uid);
    if (!project) {
      logger.warn("Generation project not found", { uid, projectId });
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    try {
      assertGenerationEnv();
    } catch {
      logger.error("Generation not configured", { uid, projectId });
      res.status(500).json({
        error: "GENERATION_NOT_CONFIGURED",
        message: "ANTHROPIC_API_KEY is not set",
      });
      return;
    }

    const generationId = randomUUID();

    logger.info("Generation started", {
      uid,
      projectId,
      generationId,
      model: env.anthropicModel,
      messageLength: message.length,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    sseRes.flushHeaders?.();

    const client = new Anthropic({ apiKey: env.anthropicApiKey });
    const parser = new FileBlockParser();
    const snapshotFiles: Record<string, SnapshotFileEntry> = {};
    let assistantText = "";
    let cancelled = false;
    let settled = false;
    let stream: ReturnType<typeof client.messages.stream> | null = null;

    const abortGeneration = (reason: string): void => {
      if (cancelled || settled) {
        return;
      }
      cancelled = true;
      logger.info("Generation cancelled", {
        uid,
        projectId,
        generationId,
        reason,
        responseLength: assistantText.length,
        filesWritten: Object.keys(snapshotFiles).length,
      });
      try {
        stream?.abort();
      } catch {
        // ignore double-abort
      }
    };

    const onResponseClose = (): void => {
      if (!settled) {
        abortGeneration("client_disconnect");
      }
    };

    sseRes.on("close", onResponseClose);

    const cleanupListeners = (): void => {
      sseRes.off("close", onResponseClose);
    };

    const processTextDelta = async (text: string): Promise<boolean> => {
      assistantText += text;
      for (const parsed of parser.push(text)) {
        if (cancelled) {
          return false;
        }
        if (parsed.type === "token") {
          if (!writeSse(sseRes, "token", { text: parsed.text })) {
            abortGeneration("sse_write_failed");
            return false;
          }
        } else if (parsed.type === "file_start") {
          if (
            !writeSse(sseRes, "file_start", {
              path: parsed.path,
              language: parsed.language,
            })
          ) {
            abortGeneration("sse_write_failed");
            return false;
          }
        } else if (parsed.type === "file_chunk") {
          if (
            !writeSse(sseRes, "file_chunk", {
              path: parsed.path,
              chunk: parsed.chunk,
            })
          ) {
            abortGeneration("sse_write_failed");
            return false;
          }
        } else if (parsed.type === "file_end") {
          const fileId = pathToFileId(parsed.path);
          await saveFile(projectId, fileId, parsed.content);
          snapshotFiles[parsed.path] = {
            content: parsed.content,
            language: parsed.language,
          };
          if (
            !writeSse(sseRes, "file_end", {
              path: parsed.path,
              language: parsed.language,
            })
          ) {
            abortGeneration("sse_write_failed");
            return false;
          }
        }
      }
      return true;
    };

    try {
      const context = await buildGenerationContext(
        projectId,
        message,
        SYSTEM_PROMPT,
      );

      if (cancelled) {
        cleanupListeners();
        if (!sseRes.writableEnded) {
          sseRes.end();
        }
        return;
      }

      await addMessage(projectId, "user", message);

      const messages: Anthropic.MessageParam[] = [...context.messages];
      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        if (cancelled) {
          break;
        }

        stream = client.messages.stream({
          model: env.anthropicModel,
          max_tokens: 16000,
          system: context.systemPrompt,
          messages,
          tools: [GET_API_DOC_TOOL],
        });

        for await (const event of stream) {
          if (cancelled || sseRes.writableEnded || sseRes.destroyed) {
            abortGeneration("loop_guard");
            break;
          }

          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const ok = await processTextDelta(event.delta.text);
            if (!ok) {
              break;
            }
          }
        }

        if (cancelled) {
          break;
        }

        const finalMessage = await stream.finalMessage();
        const toolUses = finalMessage.content.filter(
          (block): block is Anthropic.ToolUseBlock =>
            block.type === "tool_use",
        );

        if (finalMessage.stop_reason === "tool_use" && toolUses.length > 0) {
          messages.push({
            role: "assistant",
            content: finalMessage.content,
          });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUses) {
            if (toolUse.name !== "getApiDocs") {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: `Unknown tool: ${toolUse.name}`,
                is_error: true,
              });
              continue;
            }

            const doc = runGetApiDocsTool(toolUse.input);
            const endpoints =
              toolUse.input &&
              typeof toolUse.input === "object" &&
              "endpoints" in toolUse.input &&
              Array.isArray((toolUse.input as { endpoints: unknown }).endpoints)
                ? (toolUse.input as { endpoints: unknown[] }).endpoints.filter(
                    (v): v is string => typeof v === "string",
                  )
                : [];

            logger.info("getApiDocs tool", {
              uid,
              projectId,
              generationId,
              endpoints,
            });
            writeSse(sseRes, "status", {
              message:
                endpoints.length > 0
                  ? `Looking up API docs: ${endpoints.join(", ")}`
                  : "Looking up API docs",
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: doc,
            });
          }

          messages.push({
            role: "user",
            content: toolResults,
          });
          continue;
        }

        break;
      }

      if (cancelled) {
        if (!sseRes.writableEnded) {
          writeSse(sseRes, "error", {
            message: "Generation cancelled",
            code: "CANCELLED",
          });
          sseRes.end();
        }
        return;
      }

      for (const parsed of parser.flush()) {
        if (parsed.type === "token") {
          writeSse(sseRes, "token", { text: parsed.text });
        } else if (parsed.type === "file_end") {
          const fileId = pathToFileId(parsed.path);
          await saveFile(projectId, fileId, parsed.content);
          snapshotFiles[parsed.path] = {
            content: parsed.content,
            language: parsed.language,
          };
          writeSse(sseRes, "file_end", {
            path: parsed.path,
            language: parsed.language,
          });
        }
      }

      await addMessage(projectId, "assistant", assistantText, generationId);

      if (Object.keys(snapshotFiles).length > 0) {
        const snapshot = await createSnapshot(
          projectId,
          generationId,
          snapshotFiles,
          message.slice(0, 80),
        );
        writeSse(sseRes, "snapshot", { snapshotId: snapshot.id });
      }

      settled = true;
      writeSse(sseRes, "done", { generationId });
      sseRes.end();

      logger.info("Generation completed", {
        uid,
        projectId,
        generationId,
        model: env.anthropicModel,
        filesWritten: Object.keys(snapshotFiles).length,
        responseLength: assistantText.length,
        toolRounds: rounds,
      });
    } catch (err) {
      if (cancelled || isAbortError(err)) {
        abortGeneration("stream_aborted");
        if (!sseRes.writableEnded) {
          writeSse(sseRes, "error", {
            message: "Generation cancelled",
            code: "CANCELLED",
          });
          sseRes.end();
        }
        return;
      }

      const errorMessage =
        err instanceof Error ? err.message : "Generation failed";
      logger.error("Generation failed", {
        uid,
        projectId,
        generationId,
        model: env.anthropicModel,
        message: errorMessage,
      });
      settled = true;
      if (!sseRes.writableEnded) {
        writeSse(sseRes, "error", { message: errorMessage });
        sseRes.end();
      }
    } finally {
      cleanupListeners();
    }
  },
);

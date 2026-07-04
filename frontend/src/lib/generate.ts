import { auth } from "./firebase";
import type { GenerateEvent } from "../types/api";

const GENERATE_URL = import.meta.env.VITE_GENERATE_URL as string;

function parseSseChunk(
  chunk: string,
  onEvent: (event: GenerateEvent) => void,
): string {
  const parts = chunk.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    if (!part.trim()) {
      continue;
    }

    let eventName = "message";
    let dataLine = "";

    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) {
        eventName = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataLine = line.slice(6);
      }
    }

    if (!dataLine) {
      continue;
    }

    try {
      const data = JSON.parse(dataLine) as GenerateEvent["data"];
      onEvent({ event: eventName, data } as GenerateEvent);
    } catch {
      // ignore malformed events
    }
  }

  return remainder;
}

export async function streamGeneration(
  projectId: string,
  message: string,
  onEvent: (event: GenerateEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }

  const token = await user.getIdToken();
  const response = await fetch(GENERATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId, message }),
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(body.message ?? body.error ?? "Generation failed");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseChunk(buffer, onEvent);
  }

  if (buffer.trim()) {
    parseSseChunk(`${buffer}\n\n`, onEvent);
  }
}

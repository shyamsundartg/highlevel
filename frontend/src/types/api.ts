export interface ApiErrorBody {
  error?: string;
  code?: string;
  message?: string;
}

export interface HlStatus {
  connected: boolean;
  locationId?: string;
  userId?: string;
  locationName?: string;
  connectedAt?: number;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  hlLocationId: string;
  createdAt: number;
  updatedAt: number;
}

export interface FileMeta {
  fileId: string;
  path: string;
  language: string;
  sizeBytes: number;
  updatedAt: number;
}

export interface ProjectFile extends FileMeta {
  content: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  generationId?: string;
}

export interface Snapshot {
  id: string;
  label: string;
  generationId: string;
  fileCount: number;
  createdAt: number;
}

export type GenerateEvent =
  | { event: "token"; data: { text: string } }
  | { event: "file_start"; data: { path: string; language: string } }
  | { event: "file_chunk"; data: { path: string; chunk: string } }
  | { event: "file_end"; data: { path: string; language: string } }
  | { event: "snapshot"; data: { snapshotId: string } }
  | { event: "done"; data: { generationId: string } }
  | { event: "error"; data: { message: string } };

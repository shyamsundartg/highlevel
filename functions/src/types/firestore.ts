import { Timestamp } from "firebase-admin/firestore";

export interface HlConnection {
  connected: boolean;
  locationId: string;
  userId: string;
  locationName: string;
  connectedAt: Timestamp;
}

export interface UserDoc {
  email: string;
  displayName: string;
  createdAt: Timestamp;
  hlConnection: HlConnection | null;
}

export interface HlTokensDoc {
  accessToken: string;
  refreshToken: string;
  expiresAt: Timestamp;
  locationId: string;
  userId: string;
  updatedAt: Timestamp;
}

export interface ProjectDoc {
  userId: string;
  name: string;
  description: string;
  hlLocationId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp | null;
}

export interface FileDoc {
  path: string;
  content: string;
  language: string;
  sizeBytes: number;
  updatedAt: Timestamp;
}

export type MessageRole = "user" | "assistant";

export interface MessageDoc {
  role: MessageRole;
  content: string;
  createdAt: Timestamp;
  generationId?: string;
}

export interface SnapshotFileEntry {
  content: string;
  language: string;
}

export interface SnapshotDoc {
  createdAt: Timestamp;
  label: string;
  generationId: string;
  fileCount: number;
  files: Record<string, SnapshotFileEntry>;
}

export interface OAuthStateDoc {
  userId: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

/** HighLevel webhook event stored for a Genesis user (by location). */
export interface WebhookEventDoc {
  type: string;
  locationId: string;
  data: Record<string, unknown>;
  receivedAt: Timestamp;
  webhookId?: string;
}

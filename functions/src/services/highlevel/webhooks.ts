import { createPublicKey, verify } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../../config/firebase";
import { env } from "../../config/env";
import { collections } from "../../types/collections";
import { UserDoc, WebhookEventDoc } from "../../types/firestore";

const MAX_EVENTS_PER_USER = 100;

export interface IncomingHlWebhook {
  type: string;
  timestamp?: string;
  webhookId?: string;
  locationId?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StoredWebhookEvent {
  id: string;
  type: string;
  locationId: string;
  data: Record<string, unknown>;
  receivedAt: number;
  webhookId?: string;
}

function isEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

/**
 * Verify HL webhook signature (Ed25519 via X-GHL-Signature).
 * Allows unsigned events only in the local emulator when no public key is set.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  ghlSignature: string | undefined,
): boolean {
  const publicKeyPem = env.hlWebhookPublicKey;
  if (!publicKeyPem) {
    // Local emulator: allow unsigned events for curl demos.
    if (isEmulator()) {
      return true;
    }
    return false;
  }

  if (!ghlSignature) {
    return false;
  }

  try {
    const keyObject = publicKeyPem.includes("BEGIN PUBLIC KEY")
      ? createPublicKey(publicKeyPem)
      : createPublicKey({
          key: Buffer.from(publicKeyPem, "base64"),
          format: "der",
          type: "spki",
        });

    const signature = Buffer.from(ghlSignature, "base64");
    return verify(null, rawBody, keyObject, signature);
  } catch {
    return false;
  }
}

const WEBHOOK_META_KEYS = new Set([
  "type",
  "timestamp",
  "webhookId",
  "locationId",
  "data",
  "versionId",
]);

/** HL often puts event fields at the payload root (e.g. ContactCreate), not under data. */
export function extractWebhookData(
  payload: IncomingHlWebhook,
): Record<string, unknown> {
  const fromRoot: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!WEBHOOK_META_KEYS.has(key)) {
      fromRoot[key] = value;
    }
  }

  const nested =
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : {};

  if (
    nested.contact &&
    typeof nested.contact === "object" &&
    !Array.isArray(nested.contact)
  ) {
    return {
      ...nested,
      ...(nested.contact as Record<string, unknown>),
      contact: undefined,
      ...fromRoot,
    };
  }

  // Root contact fields (id, firstName, …) win over a partial nested data object.
  return { ...nested, ...fromRoot };
}

export function extractLocationId(payload: IncomingHlWebhook): string {
  if (typeof payload.locationId === "string" && payload.locationId) {
    return payload.locationId;
  }
  const data = payload.data;
  if (data && typeof data.locationId === "string" && data.locationId) {
    return data.locationId;
  }
  return "";
}

export async function findUidByLocationId(
  locationId: string,
): Promise<string | null> {
  const snapshot = await db
    .collection("users")
    .where("hlConnection.locationId", "==", locationId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return snapshot.docs[0]?.id ?? null;
}

async function pruneOldEvents(uid: string): Promise<void> {
  const snapshot = await db
    .collection(collections.webhookEvents(uid))
    .orderBy("receivedAt", "desc")
    .offset(MAX_EVENTS_PER_USER)
    .limit(50)
    .get();

  if (snapshot.empty) {
    return;
  }

  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

export async function storeWebhookEvent(
  uid: string,
  payload: IncomingHlWebhook,
  locationId: string,
): Promise<StoredWebhookEvent> {
  const ref = db.collection(collections.webhookEvents(uid)).doc();
  const receivedAt = Timestamp.now();
  const data = extractWebhookData(payload);

  const doc: WebhookEventDoc = {
    type: payload.type || "Unknown",
    locationId,
    data,
    receivedAt,
    webhookId:
      typeof payload.webhookId === "string" ? payload.webhookId : undefined,
  };

  await ref.set(doc);
  void pruneOldEvents(uid);

  return {
    id: ref.id,
    type: doc.type,
    locationId: doc.locationId,
    data: doc.data,
    receivedAt: receivedAt.toMillis(),
    webhookId: doc.webhookId,
  };
}

export async function listWebhookEvents(
  uid: string,
  options: { since?: number; limit?: number; type?: string } = {},
): Promise<StoredWebhookEvent[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  let query = db
    .collection(collections.webhookEvents(uid))
    .orderBy("receivedAt", "asc")
    .limit(limit);

  if (options.since !== undefined && Number.isFinite(options.since)) {
    query = db
      .collection(collections.webhookEvents(uid))
      .where("receivedAt", ">", Timestamp.fromMillis(options.since))
      .orderBy("receivedAt", "asc")
      .limit(limit);
  }

  const snapshot = await query.get();
  const events = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as WebhookEventDoc;
    return {
      id: docSnap.id,
      type: data.type,
      locationId: data.locationId,
      data: data.data ?? {},
      receivedAt: data.receivedAt.toMillis(),
      webhookId: data.webhookId,
    };
  });

  if (options.type) {
    return events.filter((e) => e.type === options.type);
  }
  return events;
}

/** Ensure user doc type is referenced so location query stays typed. */
export type { UserDoc };

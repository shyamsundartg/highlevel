import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../../config/firebase";
import { collections } from "../../types/collections";
import { OAuthStateDoc } from "../../types/firestore";
import { OAUTH_STATE_TTL_MS } from "./constants";

export async function createState(uid: string): Promise<string> {
  const state = randomUUID();
  const now = Date.now();

  const doc: OAuthStateDoc = {
    userId: uid,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + OAUTH_STATE_TTL_MS),
  };

  await db.doc(collections.oauthState(state)).set(doc);
  return state;
}

export async function consumeState(state: string): Promise<string> {
  if (!state) {
    throw new Error("Missing OAuth state");
  }

  const ref = db.doc(collections.oauthState(state));
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw new Error("Invalid OAuth state");
  }

  const data = snapshot.data() as OAuthStateDoc;
  await ref.delete();

  if (data.expiresAt.toMillis() < Date.now()) {
    throw new Error("Expired OAuth state");
  }

  return data.userId;
}

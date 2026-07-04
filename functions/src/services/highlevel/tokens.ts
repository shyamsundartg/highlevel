import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../../config/firebase";
import { collections } from "../../types/collections";
import {
  HlConnection,
  HlTokensDoc,
  UserDoc,
} from "../../types/firestore";
import { assertHlOAuthEnv } from "../../config/env";
import { HlApiError } from "./errors";
import { TOKEN_REFRESH_BUFFER_MS } from "./constants";
import { HlTokenResponse, refreshAccessToken } from "./oauth";

export interface ValidAccessToken {
  accessToken: string;
  locationId: string;
  userId: string;
}

export async function storeInitialTokens(
  uid: string,
  tokens: HlTokenResponse,
  locationName: string,
): Promise<void> {
  const now = Date.now();

  const tokensDoc: HlTokensDoc = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Timestamp.fromMillis(now + tokens.expires_in * 1000),
    locationId: tokens.locationId,
    userId: tokens.userId,
    updatedAt: Timestamp.fromMillis(now),
  };

  const connection: HlConnection = {
    connected: true,
    locationId: tokens.locationId,
    userId: tokens.userId,
    locationName,
    connectedAt: Timestamp.fromMillis(now),
  };

  const batch = db.batch();
  batch.set(db.doc(collections.hlTokens(uid)), tokensDoc);
  batch.set(
    db.doc(collections.users(uid)),
    { hlConnection: connection },
    { merge: true },
  );
  await batch.commit();
}

export async function getConnection(
  uid: string,
): Promise<HlConnection | null> {
  const snapshot = await db.doc(collections.users(uid)).get();
  if (!snapshot.exists) {
    return null;
  }
  const data = snapshot.data() as UserDoc;
  return data.hlConnection ?? null;
}

export async function getValidAccessToken(
  uid: string,
): Promise<ValidAccessToken> {
  const ref = db.doc(collections.hlTokens(uid));
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new HlApiError(
      "HL_NOT_CONNECTED",
      "Connect your HighLevel account first",
      400,
    );
  }

  const tokens = snapshot.data() as HlTokensDoc;
  const expiresIn = tokens.expiresAt.toMillis() - Date.now();
  if (expiresIn > TOKEN_REFRESH_BUFFER_MS) {
    if (!tokens.userId) {
      throw new HlApiError(
        "HL_RECONNECT_REQUIRED",
        "Reconnect HighLevel to refresh calendar permissions (missing userId)",
        400,
      );
    }
    return {
      accessToken: tokens.accessToken,
      locationId: tokens.locationId,
      userId: tokens.userId,
    };
  }

  assertHlOAuthEnv();
  const refreshed = await refreshAccessToken(tokens.refreshToken);
  const now = Date.now();
  const locationId = refreshed.locationId || tokens.locationId;
  const userId = refreshed.userId || tokens.userId;

  if (!userId) {
    throw new HlApiError(
      "HL_RECONNECT_REQUIRED",
      "Reconnect HighLevel to refresh calendar permissions (missing userId)",
      400,
    );
  }

  const updated: HlTokensDoc = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: Timestamp.fromMillis(now + refreshed.expires_in * 1000),
    locationId,
    userId,
    updatedAt: Timestamp.fromMillis(now),
  };

  await ref.set(updated);

  const connection: Partial<HlConnection> = {
    locationId,
    userId,
  };
  await db.doc(collections.users(uid)).set(
    { hlConnection: connection },
    { merge: true },
  );

  return { accessToken: updated.accessToken, locationId, userId };
}

export async function disconnect(uid: string): Promise<void> {
  const batch = db.batch();
  batch.delete(db.doc(collections.hlTokens(uid)));
  batch.set(
    db.doc(collections.users(uid)),
    { hlConnection: FieldValue.delete() },
    { merge: true },
  );
  await batch.commit();
}

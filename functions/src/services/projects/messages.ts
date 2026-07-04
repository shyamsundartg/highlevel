import { Timestamp } from "firebase-admin/firestore";
import { db } from "../../config/firebase";
import { collections } from "../../types/collections";
import { MessageDoc, MessageRole } from "../../types/firestore";
import { touchProject } from "./projects";

export interface SerializedMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  generationId?: string;
}

function serializeMessage(id: string, doc: MessageDoc): SerializedMessage {
  return {
    id,
    role: doc.role,
    content: doc.content,
    createdAt: doc.createdAt.toMillis(),
    generationId: doc.generationId,
  };
}

export async function listMessages(
  projectId: string,
  limit = 100,
): Promise<SerializedMessage[]> {
  const snapshot = await db
    .collection(collections.projectMessages(projectId))
    .orderBy("createdAt", "asc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) =>
    serializeMessage(doc.id, doc.data() as MessageDoc),
  );
}

export async function addMessage(
  projectId: string,
  role: MessageRole,
  content: string,
  generationId?: string,
): Promise<SerializedMessage> {
  const now = Timestamp.now();
  const ref = db.collection(collections.projectMessages(projectId)).doc();
  const doc: MessageDoc = {
    role,
    content,
    createdAt: now,
    ...(generationId ? { generationId } : {}),
  };

  await ref.set(doc);
  await touchProject(projectId);
  return serializeMessage(ref.id, doc);
}

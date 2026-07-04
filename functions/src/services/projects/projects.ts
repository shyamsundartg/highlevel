import { Timestamp } from "firebase-admin/firestore";
import { db } from "../../config/firebase";
import { getConnection } from "../highlevel/tokens";
import { collections } from "../../types/collections";
import { ProjectDoc } from "../../types/firestore";
import { ProjectWithId } from "../../utils/projectAccess";

export interface SerializedProject {
  id: string;
  userId: string;
  name: string;
  description: string;
  hlLocationId: string;
  createdAt: number;
  updatedAt: number;
}

export function serializeProject(project: ProjectWithId): SerializedProject {
  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description,
    hlLocationId: project.hlLocationId,
    createdAt: project.createdAt.toMillis(),
    updatedAt: project.updatedAt.toMillis(),
  };
}

export async function createProject(
  uid: string,
  input: { name: string; description?: string },
): Promise<ProjectWithId> {
  const connection = await getConnection(uid);
  if (!connection?.connected) {
    throw new Error("HL_NOT_CONNECTED");
  }

  const now = Timestamp.now();
  const ref = db.collection(collections.projects()).doc();
  const doc: ProjectDoc = {
    userId: uid,
    name: input.name,
    description: input.description ?? "",
    hlLocationId: connection.locationId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function listProjects(uid: string): Promise<ProjectWithId[]> {
  const snapshot = await db
    .collection(collections.projects())
    .where("userId", "==", uid)
    .where("deletedAt", "==", null)
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ProjectDoc),
  }));
}

export async function updateProject(
  projectId: string,
  uid: string,
  input: { name?: string; description?: string },
): Promise<ProjectWithId> {
  const existing = await db.doc(collections.project(projectId)).get();
  if (!existing.exists) {
    throw new Error("NOT_FOUND");
  }

  const data = existing.data() as ProjectDoc;
  if (data.userId !== uid || data.deletedAt != null) {
    throw new Error("NOT_FOUND");
  }

  const updates: Partial<ProjectDoc> = {
    updatedAt: Timestamp.now(),
  };

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.description !== undefined) {
    updates.description = input.description;
  }

  await existing.ref.update(updates);
  const updated = await existing.ref.get();
  return { id: updated.id, ...(updated.data() as ProjectDoc) };
}

export async function softDeleteProject(
  projectId: string,
  uid: string,
): Promise<void> {
  const ref = db.doc(collections.project(projectId));
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  const data = snapshot.data() as ProjectDoc;
  if (data.userId !== uid || data.deletedAt != null) {
    throw new Error("NOT_FOUND");
  }

  await ref.update({
    deletedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function touchProject(projectId: string): Promise<void> {
  await db.doc(collections.project(projectId)).update({
    updatedAt: Timestamp.now(),
  });
}

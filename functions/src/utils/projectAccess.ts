import { db } from "../config/firebase";
import { collections } from "../types/collections";
import { ProjectDoc } from "../types/firestore";

export interface ProjectWithId extends ProjectDoc {
  id: string;
}

export async function getProjectForUser(
  projectId: string,
  uid: string,
): Promise<ProjectWithId | null> {
  const snapshot = await db.doc(collections.project(projectId)).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as ProjectDoc;
  if (data.userId !== uid || data.deletedAt != null) {
    return null;
  }

  return { id: snapshot.id, ...data };
}
